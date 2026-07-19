// src/hooks/useMasterData.js
// Category / sub-category / unit options, sourced from the master tables with a
// fall back to the bundled seed constants if those tables are empty (e.g. before
// the master-data schema section has been run/seeded). So the UI always works.
import { useQuery } from "@tanstack/react-query";
import { MasterDataRepository } from "../repositories/MasterDataRepository.js";
import { CATEGORY_ORDER, SUBCATEGORY_ORDER, UNITS } from "../data/seedItems.js";

export function useMasterData() {
  const query = useQuery({
    queryKey: ["masterData"],
    queryFn: () => MasterDataRepository.getAll(),
    staleTime: 10 * 60 * 1000, // master data rarely changes
    retry: 1,
  });

  const d = query.data;
  const hasCats = Array.isArray(d?.categories) && d.categories.length > 0;
  const hasSubs = Array.isArray(d?.subCategories) && d.subCategories.length > 0;
  const hasUnits = Array.isArray(d?.units) && d.units.length > 0;

  // Categories (active only), ordered by the query (sort_order, name).
  const categories = hasCats
    ? d.categories.filter((c) => c.active !== false).map((c) => c.name)
    : CATEGORY_ORDER;

  // { categoryName: [subName, …] }, ordered.
  let subByCategory;
  if (hasSubs && hasCats) {
    const idToName = new Map(d.categories.map((c) => [c.id, c.name]));
    subByCategory = {};
    for (const s of d.subCategories) {
      if (s.active === false) continue;
      const cat = idToName.get(s.category_id);
      if (!cat) continue;
      (subByCategory[cat] ||= []).push(s.name);
    }
  } else {
    subByCategory = SUBCATEGORY_ORDER;
  }

  const units = hasUnits ? d.units.map((u) => u.code) : UNITS;

  // Display name -> icon_id, straight from the master rows. Icons are chosen by
  // this stable id (see CategoryIcon), so renaming a category/sub keeps its icon.
  const iconForCat = {};
  const iconForSub = {};
  if (hasCats) for (const c of d.categories) if (c.icon_id) iconForCat[c.name] = c.icon_id;
  if (hasSubs) for (const s of d.subCategories) if (s.icon_id) iconForSub[s.name] = s.icon_id;

  return {
    categories,
    subByCategory,
    units,
    iconForCat,
    iconForSub,
    isLoading: query.isLoading,
    fromMaster: hasCats, // true when options came from the DB tables
  };
}
