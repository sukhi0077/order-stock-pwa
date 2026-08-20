// src/repositories/FrontdeskRepository.js
//
// Membership of the front desk — the staff who must cover the desk. A tiny
// join-less table of employee ids; see frontdesk_schema.sql for why it is not
// a column on employees. Writes are admin-only, enforced in the database.
import { supabase, withTimeout, unwrap } from "../supabase.js";
import { asAppError } from "../utils/networkError.js";

const TABLE = "frontdesk_members";

export class FrontdeskRepository {
  // The employee ids on the front desk.
  static async list() {
    try {
      const data = unwrap(
        await withTimeout(supabase.from(TABLE).select("employee_id"), 15000, "Loading front desk"),
        "Loading front desk",
      );
      return (data || []).map((r) => r.employee_id);
    } catch (error) {
      throw asAppError(error, "Couldn't load the front desk list.");
    }
  }

  static async add(employeeId) {
    try {
      unwrap(
        await withTimeout(
          supabase.from(TABLE).upsert({ employee_id: employeeId }, { onConflict: "employee_id" }),
          15000,
          "Saving front desk",
        ),
        "Saving front desk",
      );
      return true;
    } catch (error) {
      throw asAppError(error, "Couldn't update the front desk list.");
    }
  }

  static async remove(employeeId) {
    try {
      unwrap(
        await withTimeout(
          supabase.from(TABLE).delete().eq("employee_id", employeeId),
          15000,
          "Saving front desk",
        ),
        "Saving front desk",
      );
      return true;
    } catch (error) {
      throw asAppError(error, "Couldn't update the front desk list.");
    }
  }
}

export default FrontdeskRepository;
