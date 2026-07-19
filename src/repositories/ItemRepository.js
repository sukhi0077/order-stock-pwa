// src/repositories/ItemRepository.js
import { supabase, withTimeout, unwrap, toTs } from "../supabase.js";
import { SEED_ITEMS, CATEGORY_ORDER, SUBCATEGORY_ORDER } from "../data/seedItems.js";

const ITEMS = "items";
const META = "app_meta";

// Category / sub-category / unit / supplier are all NORMALISED: the `items`
// table stores only FK ids, and the display names/codes come from the master
// tables via FK embeds. Explicit FK hints (…!column) keep each embed unambiguous.
const SELECT =
  "*, categories!category_id(name), sub_categories!sub_category_id(name), units!unit_id(code), suppliers!primary_supplier_id(name)";

// ----- row <-> app-object mappers -------------------------------------------
function fromRow(r) {
  return {
    id: r.id,
    code: r.code || "",
    name: r.name || "",
    nameHi: r.name_hi || "",
    category: r.categories?.name || "",
    subCategory: r.sub_categories?.name || "",
    unit: r.units?.code || "",
    orderUnit: r.order_unit || "",
    supplier: r.suppliers?.name || "",
    supplierId: r.primary_supplier_id || null,
    sortOrder: r.sort_order ?? 0,
    // Effective active in THIS app = master AND local. Staff/admin flows filter
    // on `active`, so a master-off (SupplyTracker) OR local-off item disappears.
    active: r.active !== false && r.osp_active !== false,
    globalActive: r.active !== false, // master flag (SupplyTracker owns it)
    ospActive: r.osp_active !== false, // local flag (this app owns it)
    createdAt: toTs(r.created_at),
  };
}

// Plain scalar columns only. FK-backed fields (category_id / sub_category_id /
// unit_id / primary_supplier_id) are resolved + set separately from the master
// tables, so `supplier` is NOT written here — it maps to primary_supplier_id.
function baseRow(obj = {}) {
  const map = {
    code: "code",
    name: "name",
    nameHi: "name_hi",
    orderUnit: "order_unit",
    sortOrder: "sort_order",
    active: "active",
  };
  const row = {};
  for (const [camel, snake] of Object.entries(map)) {
    if (obj[camel] !== undefined) row[snake] = obj[camel];
  }
  return row;
}

// Resolve a supplier NAME to a suppliers.id, creating the supplier row if it's
// new (upsert on the unique name). Empty name -> null (no primary supplier).
// Item admin is admin-only, so the caller also satisfies suppliers' admin-write RLS.
async function resolveSupplierId(name) {
  const nm = String(name || "").trim();
  if (!nm) return null;
  const data = unwrap(
    await withTimeout(
      supabase.from("suppliers").upsert({ name: nm }, { onConflict: "name" }).select("id").single(),
      15000,
      "Saving supplier",
    ),
    "Saving supplier",
  );
  return data?.id ?? null;
}

// ----- master-data resolution (name -> id) ----------------------------------
async function loadMaps() {
  const [catRes, subRes, unitRes] = await Promise.all([
    withTimeout(supabase.from("categories").select("id,name"), 15000, "Loading categories"),
    withTimeout(
      supabase.from("sub_categories").select("id,name,category_id"),
      15000,
      "Loading sub-categories",
    ),
    withTimeout(supabase.from("units").select("id,code"), 15000, "Loading units"),
  ]);
  const cats = unwrap(catRes, "Loading categories") || [];
  const subs = unwrap(subRes, "Loading sub-categories") || [];
  const unitsRows = unwrap(unitRes, "Loading units") || [];
  const catByName = new Map(cats.map((c) => [c.name, c.id]));
  const subByKey = new Map(subs.map((s) => [`${s.category_id}|${s.name}`, s.id]));
  const unitByCode = new Map(unitsRows.map((u) => [u.code, u.id]));
  return { catByName, subByKey, unitByCode };
}

// Make sure every (category, subCategory) in `pairs` exists in the master
// tables; returns fresh lookup maps. Newly-created rows get a canonical
// sort_order from the bundled CATEGORY_ORDER / SUBCATEGORY_ORDER.
async function ensureMasters(pairs) {
  let maps = await loadMaps();

  const newCats = [];
  const seenCat = new Set();
  for (const p of pairs) {
    const c = String(p.category || "").trim();
    if (!c || maps.catByName.has(c) || seenCat.has(c)) continue;
    seenCat.add(c);
    const idx = CATEGORY_ORDER.indexOf(c);
    newCats.push({ name: c, sort_order: idx >= 0 ? idx : 999 });
  }
  if (newCats.length) {
    unwrap(
      await withTimeout(
        supabase.from("categories").upsert(newCats, { onConflict: "name", ignoreDuplicates: true }),
        20000,
        "Creating categories",
      ),
      "Creating categories",
    );
    maps = await loadMaps();
  }

  const newSubs = [];
  const seenSub = new Set();
  for (const p of pairs) {
    const c = String(p.category || "").trim();
    const s = String(p.subCategory || "").trim();
    if (!c || !s) continue;
    const catId = maps.catByName.get(c);
    if (!catId) continue;
    const kk = `${catId}|${s}`;
    if (maps.subByKey.has(kk) || seenSub.has(kk)) continue;
    seenSub.add(kk);
    const order = (SUBCATEGORY_ORDER[c] || []).indexOf(s);
    newSubs.push({ category_id: catId, name: s, sort_order: order >= 0 ? order : 999 });
  }
  if (newSubs.length) {
    unwrap(
      await withTimeout(
        supabase
          .from("sub_categories")
          .upsert(newSubs, { onConflict: "category_id,name", ignoreDuplicates: true }),
        20000,
        "Creating sub-categories",
      ),
      "Creating sub-categories",
    );
    maps = await loadMaps();
  }

  const newUnits = [];
  const seenUnit = new Set();
  for (const p of pairs) {
    const u = String(p.unit || "").trim();
    if (!u || maps.unitByCode.has(u) || seenUnit.has(u)) continue;
    seenUnit.add(u);
    newUnits.push({ code: u });
  }
  if (newUnits.length) {
    unwrap(
      await withTimeout(
        supabase.from("units").upsert(newUnits, { onConflict: "code", ignoreDuplicates: true }),
        20000,
        "Creating units",
      ),
      "Creating units",
    );
    maps = await loadMaps();
  }

  return maps;
}

function resolveIds(maps, category, subCategory, unit) {
  const c = String(category || "").trim();
  const s = String(subCategory || "").trim();
  const u = String(unit || "").trim();
  const category_id = maps.catByName.get(c) ?? null;
  const sub_category_id =
    category_id && s ? maps.subByKey.get(`${category_id}|${s}`) ?? null : null;
  const unit_id = u ? maps.unitByCode.get(u) ?? null : null;
  return { category_id, sub_category_id, unit_id };
}

export class ItemRepository {
  // Fetch the whole master item list, sorted by sortOrder.
  static async getAll() {
    const data = unwrap(
      await withTimeout(
        supabase.from(ITEMS).select(SELECT).order("sort_order", { ascending: true }),
        15000,
        "Loading items",
      ),
      "Loading items",
    );
    return (data || []).map(fromRow);
  }

  // Seed the item list from the bundled seedItems.js the FIRST time only.
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

    const existing = unwrap(
      await withTimeout(supabase.from(ITEMS).select("id").limit(1), 15000, "Checking items"),
      "Checking items",
    );
    if (existing && existing.length > 0) {
      await ItemRepository.markSeeded();
      return false;
    }

    const maps = await ensureMasters(SEED_ITEMS);

    const chunkSize = 400;
    for (let i = 0; i < SEED_ITEMS.length; i += chunkSize) {
      const rows = SEED_ITEMS.slice(i, i + chunkSize).map((it) => ({
        ...baseRow({ ...it, active: it.active !== false }),
        ...resolveIds(maps, it.category, it.subCategory, it.unit),
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
  // matching by item NAME (case-insensitive). Nothing is ever deleted.
  static async resyncFromSeed() {
    const key = (s) => String(s || "").trim().toLowerCase();

    const rows = unwrap(
      await withTimeout(supabase.from(ITEMS).select("id,name,osp_active"), 20000, "Loading items"),
      "Loading items",
    );
    const existing = new Map();
    (rows || []).forEach((r) => existing.set(key(r.name), r));

    const maps = await ensureMasters(SEED_ITEMS);

    const seedKeys = new Set(SEED_ITEMS.map((it) => key(it.name)));
    const toInsert = [];
    const toUpdate = [];
    let added = 0;
    let updated = 0;
    let deactivated = 0;

    for (const it of SEED_ITEMS) {
      // Never write the master `active` flag on resync — SupplyTracker owns it.
      const fields = {
        ...baseRow({
          name: it.name,
          unit: it.unit,
          code: it.code || "",
          sortOrder: it.sortOrder,
        }),
        ...resolveIds(maps, it.category, it.subCategory, it.unit),
      };
      const match = existing.get(key(it.name));
      if (match) {
        toUpdate.push({ id: match.id, fields });
        updated += 1;
      } else {
        // Brand-new items are active in both apps.
        toInsert.push({ ...fields, active: true, osp_active: true });
        added += 1;
      }
    }

    // Items no longer in the seed are disabled LOCALLY only (osp_active),
    // leaving the master `active` flag for SupplyTracker to manage.
    for (const [k, r] of existing) {
      if (!seedKeys.has(k) && r.osp_active !== false) {
        toUpdate.push({ id: r.id, fields: { osp_active: false } });
        deactivated += 1;
      }
    }

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
    const maps = await ensureMasters([
      { category: item.category, subCategory: item.subCategory, unit: item.unit },
    ]);
    const row = {
      ...baseRow({ ...item, active: true }),
      ...resolveIds(maps, item.category, item.subCategory, item.unit),
      primary_supplier_id: await resolveSupplierId(item.supplier),
    };
    const data = unwrap(
      await withTimeout(
        supabase.from(ITEMS).insert(row).select("id").single(),
        15000,
        "Adding item",
      ),
      "Adding item",
    );
    return data.id;
  }

  // Update fields on an existing item (admin).
  static async update(itemId, patch) {
    const row = { ...baseRow(patch), updated_at: new Date().toISOString() };
    // Supplier is stored as a FK: resolve the name -> primary_supplier_id.
    if (patch.supplier !== undefined) {
      row.primary_supplier_id = await resolveSupplierId(patch.supplier);
    }
    // Only touch the master FKs the patch actually changes.
    const needsCat = patch.category !== undefined || patch.subCategory !== undefined;
    const needsUnit = patch.unit !== undefined;
    if (needsCat || needsUnit) {
      const maps = await ensureMasters([
        { category: patch.category, subCategory: patch.subCategory, unit: patch.unit },
      ]);
      const ids = resolveIds(maps, patch.category, patch.subCategory, patch.unit);
      if (needsCat) {
        row.category_id = ids.category_id;
        row.sub_category_id = ids.sub_category_id;
      }
      if (needsUnit) row.unit_id = ids.unit_id;
    }
    unwrap(
      await withTimeout(
        supabase.from(ITEMS).update(row).eq("id", itemId),
        15000,
        "Updating item",
      ),
      "Updating item",
    );
    return true;
  }

  // Soft-deactivate / reactivate in THIS app only: writes the LOCAL `osp_active`
  // flag, never the master `active` (which SupplyTracker owns). So disabling an
  // item here never affects SupplyTracker.
  static async setActive(itemId, active) {
    unwrap(
      await withTimeout(
        supabase
          .from(ITEMS)
          .update({ osp_active: !!active, updated_at: new Date().toISOString() })
          .eq("id", itemId),
        15000,
        "Updating item",
      ),
      "Updating item",
    );
    return true;
  }
}
