# Merging with SupplyTracker — schema plan

This app (Order & Stock, a mobile **capture** front-end on Supabase) is designed
to fold into **SupplyTracker** (the Django/Postgres app that is the **system of
record** for the catalogue, suppliers, invoices, and inventory). This note
explains how the schema is set up so that merge is a straightforward data import
rather than a rewrite.

## The one thing that makes it work: a shared item code

Both apps were seeded from the **same items sheet**, so every catalogue item has
the same stable code (`ITM-####`). That code is the join key between the two
systems. The `MERGE-READINESS` section of `schema.sql` enforces it:

- `items.code` is now **unique**, and every item is guaranteed to have one.
- Items added inside this app (which have no `ITM-` code) get an auto-generated
  `OSP-#####` code on insert. The distinct prefix means "created in the capture
  app" — at merge time these are either matched to an existing SupplyTracker
  item or created as new ones.
- `items.name` is also made unique (SupplyTracker requires unique names too).

## How the two catalogues line up

| Order & Stock (`items`) | SupplyTracker (`core.Item`) | Notes |
|---|---|---|
| `code` | `code` | **Join key.** `ITM-####` shared; `OSP-#####` = app-origin |
| `name` | `name` | Unique in both |
| `category_id` → `categories.name` | `SubCategory.category.name` | FK; names match (same sheet) |
| `sub_category_id` → `sub_categories.name` | `SubCategory.name` | FK; names match (same sheet) |
| `unit` (text) | `Item.default_unit` | Human label |
| `uom_code` (new) | `UnitOfMeasure.code` | Canonical unit (e.g. `btl`, `kg`) — fill during merge where the display label differs |
| `vat_rate` (new, default 23) | `Item.default_vat_rate` | Carried for round-trip |
| `match_keywords` (new) | `Item.match_keywords` | KSeF matching keywords |
| `supplier` (text) | `Item.primary_supplier.name` | Matched by name |
| `active` | `Item.is_active` | |

Suppliers gained `nip` and `ksef_name` columns so a mobile-entered supplier can
be reconciled to a `core.Supplier` by tax id / legal name, not just display name.

### Master data tables

Category, sub-category and unit are now real reference tables — the direct
counterparts of SupplyTracker's `Category`, `SubCategory`, and `UnitOfMeasure`:

| This app | SupplyTracker | Key |
|---|---|---|
| `categories(name)` | `core.Category(name)` | `name` (unique) |
| `sub_categories(category_id, name)` | `core.SubCategory(category, name)` | `(category, name)` |
| `units(code)` | `core.UnitOfMeasure(code)` | `code` (unique) |

`items` carries FK columns `category_id`, `sub_category_id`, `unit_id`.
**Category and sub-category are the source of truth in these tables** — the old
text columns on `items` have been migrated into them and dropped, and the app
reads category/sub-category by joining and writes the FKs. `unit` remains a text
column, linked to `units.unit_id` by a `SECURITY DEFINER` trigger
(`items_link_masters`) that creates the unit master row on write. The
`units.code` values are the app's unit strings (e.g. `bottle`); map them to
SupplyTracker's canonical codes (`btl`) via `items.uom_code` / the `units` table
during the merge.

## The captured data, already shaped for SupplyTracker

The app stores counts and orders as JSONB. Three **read-only views** project that
into the relational shape SupplyTracker expects — no app change, just `SELECT`:

| View | Row = | Maps to SupplyTracker |
|---|---|---|
| `merge_stock_movements` | one item's closing count for a month, with `happened_at` = month-end date | `StockMovement(kind='count')` — a dated stock reading per item |
| `merge_receipts` | one received batch (qty, expiry) | `StockMovement(kind='purchase_in')`; keep `expiry` as batch metadata |
| `merge_order_lines` | one line of a purchase order (qty, note) | reorder signal / `InvoiceDetail` seed — **not** stock |

Each view already exposes `item_code`, so the import joins straight onto
`core.Item.code`. Example:

```sql
select item_code, item_name, happened_at, closing_qty, uom
from merge_stock_movements
order by happened_at desc, item_name;
```

## Merge steps (when you're ready)

1. **Codes:** confirm `ITM-` codes match SupplyTracker; decide per `OSP-` item
   whether to match an existing SupplyTracker item (repoint the code) or create
   a new one.
2. **Suppliers:** reconcile by `nip` / `ksef_name`, else by `name`.
3. **Units:** fill `uom_code` where the display `unit` differs from
   SupplyTracker's `UnitOfMeasure.code` (e.g. `bottle` → `btl`).
4. **Import inventory:** `merge_stock_movements` → `StockMovement` (as `count`,
   or map to `opening`/`adjustment` per your reconciliation rules);
   `merge_receipts` → `StockMovement(kind='purchase_in')`.
5. **Import purchasing:** `merge_order_lines` → reorder history / `InvoiceDetail`.
6. **Expiry:** SupplyTracker has no expiry/batch model. Either add one there, or
   keep expiry as receipt metadata carried on the purchase movement.

## Why this stays clean

Everything above is **additive and idempotent** — it does not change how the app
reads or writes, only adds a stable key, a few nullable columns, and views. So
the capture app keeps working exactly as now, and the day you merge, the data is
already keyed and shaped for a plain ETL into SupplyTracker.
