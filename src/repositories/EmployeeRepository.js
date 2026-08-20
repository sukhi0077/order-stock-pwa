// src/repositories/EmployeeRepository.js
//
// The employee roster (public.employees). Replaces the Firestore
// app_settings/coupon_staff names array with a real table, so it now serves
// two jobs: the "who filed this report" dropdown, and the Google-review
// coupon roster.
//
// Employees are never hard-deleted — dsr_reports.reporter_id is ON DELETE
// RESTRICT, so removing someone who has filed a report would fail anyway.
// Deactivating (active = false) hides them from the dropdown and keeps history.
import { supabase } from "../supabase.js";

// Columns read everywhere. is_frontdesk marks the staff who must cover the
// front desk — see frontdesk_column.sql. One bit per person, so a column, not
// a table; the availability and rota screens read it to flag uncovered days.
const COLS = "id, name, active, sort_order, is_frontdesk";

const withTimeout = (promise, ms = 15000, label = "Request") => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out. Check your connection.`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

export class EmployeeRepository {
  // Everyone, active first, in the admin's chosen order.
  static async list({ activeOnly = false } = {}) {
    let q = supabase
      .from("employees")
      .select(COLS)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (activeOnly) q = q.eq("active", true);

    const { data, error } = await withTimeout(q, 15000, "Loading employees");
    if (error) throw error;
    return data || [];
  }

  static async create(name, sortOrder = 0) {
    const { data, error } = await withTimeout(
      supabase
        .from("employees")
        .insert({ name, sort_order: sortOrder })
        .select(COLS)
        .single(),
      15000,
      "Adding employee",
    );
    if (error) throw error;
    return data;
  }

  static async update(id, patch) {
    const { data, error } = await withTimeout(
      supabase
        .from("employees")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(COLS)
        .single(),
      15000,
      "Saving employee",
    );
    if (error) throw error;
    return data;
  }

  static setActive(id, active) {
    return EmployeeRepository.update(id, { active });
  }

  static setFrontdesk(id, isFrontdesk) {
    return EmployeeRepository.update(id, { is_frontdesk: isFrontdesk });
  }
}
