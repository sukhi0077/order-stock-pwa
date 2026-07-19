# Database normalization — review & migration

Both apps run on **one shared Supabase project** (`ghzchiityizvkranlnxw`).
`order-stock-pwa` is the mobile capture front-end (month-end counts, purchase
orders, received-stock/expiry batches); `supplytracker-pwa` is the system of
record (catalogue, suppliers, invoices, KSeF mappings, stock). This note reviews
the normal-form problems that existed in the shared schema and documents the
changes made to fix them.

The reference dimensions (`categories`, `sub_categories`, `units`) were already
proper master tables with FKs — that part was fine. Everything below is what was
still denormalized, plus how it was resolved. All changes are **additive,
idempotent, and data-preserving**: each app's `schema.sql` remains the migration
(re-run it any time), and the transitions only fire while the old shape is still
present, so a fresh install and a re-run are both no-ops on the normalized parts.

## What was denormalized, and the fix

### 1. `items` stored the unit three different ways
`items.unit_id` (FK → `units`), `items.default_uom_id` (a second FK → `units`),
and `items.uom_code` (free text) all encoded the same fact. Only `unit_id` was
actually read/written by either app's live UI.

**Fix:** `unit_id` is now the single source of truth. `default_uom_id` and
`uom_code` are folded into `unit_id` (where it was unset) and then dropped. The
merge views and both apps now read the canonical code by joining `units.code`.

### 2. `items.supplier` (text) duplicated `items.primary_supplier_id` (FK)
The primary supplier was stored both as a free-text name and as a real FK — a
classic transitive-dependency (3NF) violation, and the two could disagree.

**Fix:** `primary_supplier_id` (FK → `suppliers`) is the source of truth; the
text `supplier` column is migrated into `suppliers` + the FK, then dropped. Both
apps expose the supplier **name** by joining. `order-stock-pwa` (where an admin
types a supplier on an item) now resolves that name to a `suppliers` row,
creating it if new — so mobile-entered suppliers become real, reconcilable
entities instead of loose strings.

### 3. `receipts` used a text `item_id` and copied item fields
`receipts.item_id` was `text` (a uuid stored as a string, with no FK), and
`item_name / unit / category / sub_category` were duplicated onto every row.

**Fix:** `item_id` is now a real `uuid` FK → `items` (`on delete restrict`), and
the display fields are read by joining the catalogue. A catalogue rename now
flows through automatically. Orphan references (an item that no longer exists)
migrate to `NULL` rather than breaking the FK.

### 4. `stock_counts.lines` / `orders.lines` were JSONB blobs
Each month's counts and each order's lines were a single JSONB document
(`itemId → qty`, `itemId → {qty, note}`) — not decomposed to rows, so nothing
could be indexed, FK-checked, or joined at the line level.

**Fix:** two proper line tables, `stock_count_lines (month_id, item_id, qty)` and
`order_lines (order_id, item_id, qty, note)`, both with FKs to `items`. Existing
JSONB is migrated into them and the columns are dropped. To keep saves atomic
(the client can't run multi-statement transactions), writes now go through two
`SECURITY DEFINER` RPCs — `save_stock_count(...)` and `save_order(...)` — which
upsert the header and replace its lines in one server-side transaction while
enforcing exactly the old staff/admin rules (staff may edit only the current,
non-finalized month; may never set `finalized`; may edit an order only while it
is still a draft). The apps keep working with the same `lines` map internally;
only the repository layer changed.

### 5. `sales_records` weren't linked to the catalogue
Monthly POS uploads carried `category` and `item_name` as text with no link to
`items`.

**Fix:** a nullable `item_id` FK is added and back-filled by matching the
uploaded name to a catalogue item. The raw text label and the natural
`(month, category, item_name)` upload key are intentionally kept — sales rows are
external data, so the FK is a best-effort enrichment, not a hard dependency.

### Intentionally left as-is
`invoice_lines.unit` (the unit exactly as printed on a supplier/KSeF invoice) and
`sales_records.item_name/category` (raw POS labels) are **source-document data**,
not references into the catalogue, so they stay atomic text. `reporter` on
counts/orders/receipts is a staff-entered display name (devices may be shared),
so it stays text rather than being forced into a user FK.

## Catalogue field mapping (after normalization)

| Concept | Column (source of truth) | Read as |
|---|---|---|
| Category | `items.category_id` → `categories` | name via join |
| Sub-category | `items.sub_category_id` → `sub_categories` | name via join |
| Unit | `items.unit_id` → `units` | `units.code` via join |
| Primary supplier | `items.primary_supplier_id` → `suppliers` | name via join |

## How to apply (existing production DB)

Run in this order in the Supabase SQL editor — both are idempotent and preserve
data:

1. `order-stock-pwa/supabase/schema.sql`
2. `supplytracker-pwa/supabase/schema.sql`

Then deploy both apps' updated code. No data entry is lost: counts, orders,
receipts, suppliers and units are migrated in place.

## Verification

The migration was validated against a real PostgreSQL 18 engine (via PGlite):

- **Fresh install** of both `schema.sql` files, then **re-run twice** — no errors
  (idempotent), and the end-state has the redundant columns dropped, the line
  tables + RPCs + rewritten merge views present.
- **Legacy → normalized** on seeded data: supplier text resolved to FKs (a
  never-seen supplier auto-created and linked), JSONB counts/orders migrated to
  line rows (a `qty = 0` and an order note both preserved), receipts migrated to
  a uuid FK with the item name resolved by join, and all three `merge_*` views
  returning the expected rows with the unit code sourced from `unit_id`.
- **RPC behaviour:** `save_stock_count` / `save_order` atomically replace lines
  and set header status, drop `qty ≤ 0` order lines, and block a staff
  `finalized` write.
- Both apps' full module graphs bundle cleanly (all imports/exports resolve).
