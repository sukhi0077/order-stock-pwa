// src/repositories/MasterDataRepository.js
// Reads the master/reference tables (categories, sub_categories, units).
import { supabase, withTimeout, unwrap } from "../supabase.js";

export class MasterDataRepository {
  static async getCategories() {
    const data = unwrap(
      await withTimeout(
        supabase
          .from("categories")
          .select("id,name,sort_order,active")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        15000,
        "Loading categories",
      ),
      "Loading categories",
    );
    return data || [];
  }

  static async getSubCategories() {
    const data = unwrap(
      await withTimeout(
        supabase
          .from("sub_categories")
          .select("id,category_id,name,sort_order,active")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        15000,
        "Loading sub-categories",
      ),
      "Loading sub-categories",
    );
    return data || [];
  }

  static async getUnits() {
    const data = unwrap(
      await withTimeout(
        supabase.from("units").select("id,code,name").order("code", { ascending: true }),
        15000,
        "Loading units",
      ),
      "Loading units",
    );
    return data || [];
  }

  // Fetch all three in parallel.
  static async getAll() {
    const [categories, subCategories, units] = await Promise.all([
      MasterDataRepository.getCategories(),
      MasterDataRepository.getSubCategories(),
      MasterDataRepository.getUnits(),
    ]);
    return { categories, subCategories, units };
  }
}
