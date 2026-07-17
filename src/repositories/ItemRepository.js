// src/repositories/ItemRepository.js
import { supabase, withTimeout, unwrap, toTs } from "../supabase.js";
import { SEED_ITEMS } from "../data/seedItems.js";

const ITEMS = "items";
const META = "app_meta";

// ----- row <-> app-object mappers -------------------------------------------
// The UI/models use camelCase (subCategory, sortOrder, orderUnit, nameHi); the
// DB uses snake_case. Map at the boundary so nothing else has to change.
function fromRow(r) {
  return {
    id: r.id,
    code: r.code || "",
    name: r.name || "",
    nameHi: r.name_hi || "",
    category: r.category || "",
    subCategory: r.sub_category || "",
    unit: r.unit || "",
    orderUnit: r.order_unit || "",
    supplier: r.supplier || "",
    sortOrder: r.sort_order ?? 0,
    active: r.active !== false,
    createdAt: toTs(r.created_at),
  };
}

// Only translate the keys that are present on the incoming patch/object.
function toRow(obj = {}) {
  const map = {
    code: "code",
    name: "name",
    nameHi: "name_hi",
    category: "category",
    subCategory: "sub_category",
    unit: "unit",
    orderUnit: "order_unit",
    supplier: "supplier",
    sortOrder: "sort_order",
    active: "active",
  };
  const row = {};
  for (const [camel, snake] of Object.entries(map)) {
    if (obj[camel] !== undefined) row[snake] = obj[camel];
  }
  return row;
}

export class ItemRepository {
  // Fetch the whole master item list, sorted by sortOrder.
  static async getAll() {
    const data = unwrap(
      await withTimeout(
        supabase.from(ITEMS).select("*").order("sort_order", { ascending: true }),
        15000,
        "Loading items",
      ),
      "Loading items",
    );
    return (data || []).map(fromRow);
  }

  // Seed the item list from the bundled seedItems.js the FIRST time only.
  // Guarded by app_meta/seed so it runs once. Admin-only (RLS enforces it).
  // Returns true if seeding happened, false if it was already seeded.
  static async seedIfEmpty() {
    const flag = unwrap(
      await withTimeout(
        supabase.from(META).select("done").eq("key", "seed").maybeSingle(),
        15000,
        "Checking setup",
      ),
      "Checking setup",
    );
    if (flag?.done) return false;

    // Defensive: bail if items already exist even without the flag.
    const existing = unwrap(
      await withTimeout(
        supabase.from(ITEMS).select("id").limit(1),
        15000,
        "Checking items",
      ),
      "Checking items",
    );
    if (existing && existing.length > 0) {
      await ItemRepository.markSeeded();
      return false;
    }

    // Insert in chunks to keep each request modest.
    const chunkSize = 400;
    for (let i = 0; i < SEED_ITEMS.length; i += chunkSize) {
      const rows = SEED_ITEMS.slice(i, i + chunkSize).map((it) => ({
        ...toRow({ ...it, active: it.active !== false }),
      }));
      unwrap(
        await withTimeout(supabase.from(ITEMS).insert(rows), 20000, "Seeding items"),
        "Seeding items",
      );
    }
    await ItemRepository.markSeeded();
    return true;
  }

  static async markSeeded() {
    await supabase
      .from(META)
      .upsert({ key: "seed", done: true, seeded_at: new Date().toISOString() });
  }

  // Re-sync the live item list with the bundled master list (SEED_ITEMS),
  // matching by item NAME (case-insensitive):
  //   - updates category / sub-category / unit / code / order on matches,
  //   - creates items new in the master list,
  //   - deactivates items no longer in the master list,
  //   - PRESERVES each item's supplier (never overwritten).
  // Nothing is ever deleted. Returns { added, updated, deactivated }.
  static async resyncFromSeed() {
    const key = (s) => String(s || "").trim().toLowerCase();

    const rows = unwrap(
      await withTimeout(supabase.from(ITEMS).select("*"), 20000, "Loading items"),
      "Loading items",
    );
    const existing = new Map();
    (rows || []).forEach((r) => existing.set(key(r.name), r));

    const seedKeys = new Set(SEED_ITEMS.map((it) => key(it.name)));
    const toInsert = [];
    const toUpdate = [];
    let added = 0;
    let updated = 0;
    let deactivated = 0;

    for (const it of SEED_ITEMS) {
      const fields = toRow({
        name: it.name,
        category: it.category,
        subCategory: it.subCategory,
        unit: it.unit,
        code: it.code || "",
        sortOrder: it.sortOrder,
        active: it.active !== false,
      });
      const match = existing.get(key(it.name));
      if (match) {
        toUpdate.push({ id: match.id, fields });
        updated += 1;
      } else {
        toInsert.push(fields);
        added += 1;
      }
    }

    // Deactivate anything not in the new master list (keep supplier + history).
    for (const [k, r] of existing) {
      if (!seedKeys.has(k) && r.active !== false) {
        toUpdate.push({ id: r.id, fields: { active: false } });
        deactivated += 1;
      }
    }

    // Inserts in chunks.
    const chunk = 400;
    for (let i = 0; i < toInsert.length; i += chunk) {
      unwrap(
        await withTimeout(
          supabase.from(ITEMS).insert(toInsert.slice(i, i + chunk)),
          25000,
          "Adding items",
        ),
        "Adding items",
      );
    }
    // Updates one by one (targeted patches; count is modest).
    for (const u of toUpdate) {
      unwrap(
        await withTimeout(
          supabase.from(ITEMS).update(u.fields).eq("id", u.id),
          25000,
          "Updating items",
        ),
        "Updating items",
      );
    }

    await ItemRepository.markSeeded();
    return { added, updated, deactivated };
  }

  // Create a new item (admin).
  static async add(item) {
    const data = unwrap(
      await withTimeout(
        supabase
          .from(ITEMS)
          .insert({ ...toRow({ ...item, active: true }) })
          .select("id")
          .single(),
        15000,
        "Adding item",
      ),
      "Adding item",
    );
    return data.id;
  }

  // Update fields on an existing item (admin).
  static async update(itemId, patch) {
    unwrap(
      await withTimeout(
        supabase
          .from(ITEMS)
          .update({ ...toRow(patch), updated_at: new Date().toISOString() })
          .eq("id", itemId),
        15000,
        "Updating item",
      ),
      "Updating item",
    );
    return true;
  }

  // Soft-deactivate / reactivate rather than delete, so history stays intact.
  static async setActive(itemId, active) {
    return ItemRepository.update(itemId, { active: !!active });
  }
}
