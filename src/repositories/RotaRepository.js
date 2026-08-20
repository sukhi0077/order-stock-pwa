// src/repositories/RotaRepository.js
//
// The rota: the owner's schedule, plus each month's publish state. Shift rows
// carry clock times as HH:MM strings; see RotaModel/TimesheetModel for why they
// are not timestamps. Writes are admin-only, enforced in the database (RLS);
// this layer does not re-check — a staff device's write simply fails there.
import { supabase, withTimeout, unwrap } from "../supabase.js";
import { asAppError } from "../utils/networkError.js";
import { monthEndDate } from "../utils/monthUtils.js";

const SHIFTS = "rota_shifts";
const MONTHS = "rota_months";

const hhmm = (t) => (typeof t === "string" ? t.slice(0, 5) : "");

function fromRow(r) {
  return {
    employeeId: r.employee_id,
    onDate: r.on_date,
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    note: r.note || "",
  };
}

export class RotaRepository {
  // Every shift in a month, everyone. Optionally narrowed to one employee — the
  // staff view only ever wants its own.
  static async listMonth(monthId, employeeId = null) {
    try {
      let q = supabase
        .from(SHIFTS)
        .select("*")
        .gte("on_date", `${monthId}-01`)
        .lte("on_date", monthEndDate(monthId))
        .order("on_date", { ascending: true });
      if (employeeId) q = q.eq("employee_id", employeeId);
      const data = unwrap(await withTimeout(q, 15000, "Loading rota"), "Loading rota");
      return (data || []).map(fromRow);
    } catch (error) {
      throw asAppError(error, "Couldn't load the rota.");
    }
  }

  // Schedule an employee for a date, with optional times. Upsert, not insert:
  // the same cell is toggled and re-timed repeatedly, and the key is
  // (employee_id, on_date).
  static async setShift(employeeId, onDate, value = {}) {
    try {
      unwrap(
        await withTimeout(
          supabase.from(SHIFTS).upsert(
            {
              employee_id: employeeId,
              on_date: onDate,
              start_time: value.startTime || null,
              end_time: value.endTime || null,
              note: String(value.note || "").slice(0, 200),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "employee_id,on_date" },
          ),
          15000,
          "Saving rota",
        ),
        "Saving rota",
      );
      return true;
    } catch (error) {
      throw asAppError(error, "Couldn't save that shift.");
    }
  }

  // Take an employee off a date entirely — the row goes, which is what
  // "not scheduled" means.
  static async clearShift(employeeId, onDate) {
    try {
      unwrap(
        await withTimeout(
          supabase.from(SHIFTS).delete().eq("employee_id", employeeId).eq("on_date", onDate),
          15000,
          "Saving rota",
        ),
        "Saving rota",
      );
      return true;
    } catch (error) {
      throw asAppError(error, "Couldn't clear that shift.");
    }
  }

  // ---- publish state ------------------------------------------------------

  // The publish status of a month. A month with no row has never been touched,
  // so it is a draft — null is returned and the caller treats it as such.
  static async getMonthStatus(monthId) {
    try {
      const data = unwrap(
        await withTimeout(
          supabase.from(MONTHS).select("*").eq("month_id", monthId).maybeSingle(),
          15000,
          "Loading rota",
        ),
        "Loading rota",
      );
      if (!data) return { monthId, status: "draft", publishedAt: null };
      return { monthId: data.month_id, status: data.status, publishedAt: data.published_at };
    } catch (error) {
      throw asAppError(error, "Couldn't load the rota status.");
    }
  }

  static async setMonthStatus(monthId, status) {
    try {
      unwrap(
        await withTimeout(
          supabase.from(MONTHS).upsert(
            {
              month_id: monthId,
              status,
              published_at: status === "published" ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "month_id" },
          ),
          15000,
          "Saving rota",
        ),
        "Saving rota",
      );
      return true;
    } catch (error) {
      throw asAppError(error, "Couldn't change the rota status.");
    }
  }
}

export default RotaRepository;
