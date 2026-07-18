// src/repositories/ItemRepository.js
import { supabase, withTimeout, unwrap, toTs } from "../supabase.js";
import { SEED_ITEMS, CATEGORY_ORDER, SUBCATEGORY_ORDER } from "../data/seedItems.js";

const ITEMS = "items";
const META = "app_meta";

// Category + sub-category NAMES come from the master tables via FK embeds — the
// `items` table no longer stores them as text. `unit` remains a text column.
const SELECT = "*, categories(name), sub_categories(name)";

// ----- row <-> app-object mappers -------------------------------------------
function fromRow(r) {
  return {
    id: r.id,
    code: r.code || "",
    name: r.name || "",
    nameHi: r.name_hi || "",
    category: r.categories?.name || "",
    subCategory: r.sub_categories?.name || "",
    unit: r.unit || "",
    orderUnit: r.order_unit || "",
    supplier: r.supplier || "",
    sortOrder: r.sort_order ?? 0,
    active: r.active !== false,
    createdAt: toTs(r.created_at),
  };
}

// Non-category columns only (category_id / sub_category_id are resolved + set
// separately from the master tables).
function baseRow(obj = {}) {
  const map = {
    code: "code",
    name: "name",
    nameHi: "name_hi",
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

// ----- master-data resolution (name -> id) ----------------------------------
async function loadMaps() {
  const [catRes, subRes] = await Promise.all([
    withTimeout(supabase.from("categories").select("id,name"), 15000, "Loading categories"),
    withTimeout(
      supabase.from("sub_categories").select("id,name,category_id"),
      15000,
      "Loading sub-categories",
    ),
  ]);
  const cats = unwrap(catRes, "Loading categories") || [];
  const subs = unwrap(subRes, "Loading sub-categories") || [];
  const catByName = new Map(cats.map((c) => [c.name, c.id]));
  const subByKey = new Map(subs.map((s) => [`${s.category_id}|${s.name}`, s.id]));
  return { catByName, subByKey };
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

  return maps;
}

function resolveIds(maps, category, subCategory) {
  const c = String(category || "").trim();
  const s = String(subCategory || "").trim();
  const category_id = maps.catByName.get(c) ?? null;
  const sub_category_id =
    category_id && s ? maps.subByKey.get(`${category_id}|${s}`) ?? null : null;
  return { category_id, sub_category_id };
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
        ...resolveIds(maps, it.category, it.subCategory),
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
      await withTimeout(supabase.from(ITEMS).select("id,name,active"), 20000, "Loading items"),
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
      const fields = {
        ...baseRow({
          name: it.name,
          unit: it.unit,
          code: it.code || "",
          sortOrder: it.sortOrder,
          active: it.active !== false,
        }),
        ...resolveIds(maps, it.category, it.subCategory),
      };
      const match = existing.get(key(it.name));
      if (match) {
        toUpdate.push({ id: match.id, fields });
        updated += 1;
      } else {
        toInsert.push(fields);
        added += 1;
      }
    }

    for (const [k, r] of existing) {
      if (!seedKeys.has(k) && r.active !== false) {
        toUpdate.push({ id: r.id, fields: { active: false } });
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
    const maps = await ensureMasters([{ category: item.category, subCategory: item.subCategory }]);
    const row = {
      ...baseRow({ ...item, active: true }),
      ...resolveIds(maps, item.category, item.subCategory),
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
    // Only touch the category FKs when the patch actually changes them.
    if (patch.category !== undefined || patch.subCategory !== undefined) {
      const maps = await ensureMasters([
        { category: patch.category, subCategory: patch.subCategory },
      ]);
      Object.assign(row, resolveIds(maps, patch.category, patch.subCategory));
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

  // Soft-deactivate / reactivate rather than delete, so history stays intact.
  static async setActive(itemId, active) {
    return ItemRepository.update(itemId, { active: !!active });
  }
}
