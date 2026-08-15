// src/repositories/TimesheetRepository.js
//
// Timesheet entries and availability. Rows carry clock times as HH:MM strings;
// see TimesheetModel for why they are not timestamps.
import { supabase, withTimeout, unwrap } from "../supabase.js";
import { asAppError } from "../utils/networkError.js";
import { monthEndDate } from "../utils/monthUtils.js";

const ENTRIES = "timesheet_entries";
const WEEKLY = "employee_availability_weekly";
const DATES = "employee_availability_dates";

// Postgres returns a `time` as "17:00:00"; the UI and the model both speak
// "17:00". Trimming here means only one place has to know that.
const hhmm = (t) => (typeof t === "string" ? t.slice(0, 5) : "");

function fromRow(r) {
  return {
    id: r.id,
    employeeId: r.employee_id,
    workDate: r.work_date,
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    // Still read: breaks are no longer entered, but rows saved before the
    // field was dropped carry one, and their totals depend on it.
    breakMinutes: r.break_minutes ?? 0,
    note: r.note || "",
  };
}

// break_minutes is deliberately absent. On an insert the column takes its
// default of 0; on an update the stored value is left alone, so correcting the
// end time of an old row cannot quietly hand back the break it already had
// deducted. The column stays in the schema because dropping it would destroy
// the history behind hours that have already been paid.
function toRow(e) {
  return {
    employee_id: e.employeeId,
    work_date: e.workDate,
    start_time: e.startTime,
    end_time: e.endTime,
    note: e.note || "",
  };
}

export class TimesheetRepository {
  // Every entry in a month. Optionally narrowed to one employee — the staff
  // screen only ever wants its own, and fetching everyone's would leak other
  // people's hours onto a shared device.
  static async listMonth(monthId, employeeId = null) {
    try {
      let q = supabase
        .from(ENTRIES)
        .select("*")
        .gte("work_date", `${monthId}-01`)
        .lte("work_date", monthEndDate(monthId))
        .order("work_date", { ascending: true });
      if (employeeId) q = q.eq("employee_id", employeeId);
      const data = unwrap(await withTimeout(q, 15000, "Loading timesheet"), "Loading timesheet");
      return (data || []).map(fromRow);
    } catch (error) {
      throw asAppError(error, "Couldn't load the timesheet.");
    }
  }

  static async add(entry) {
    try {
      const data = unwrap(
        await withTimeout(
          supabase.from(ENTRIES).insert(toRow(entry)).select("*").single(),
          15000,
          "Saving hours",
        ),
        "Saving hours",
      );
      return fromRow(data);
    } catch (error) {
      throw asAppError(error, "Couldn't save those hours.");
    }
  }

  static async update(id, entry) {
    try {
      const data = unwrap(
        await withTimeout(
          supabase
            .from(ENTRIES)
            .update({ ...toRow(entry), updated_at: new Date().toISOString() })
            .eq("id", id)
            .select("*")
            .single(),
          15000,
          "Saving hours",
        ),
        "Saving hours",
      );
      return fromRow(data);
    } catch (error) {
      throw asAppError(error, "Couldn't save that change.");
    }
  }

  static async remove(id) {
    try {
      unwrap(
        await withTimeout(supabase.from(ENTRIES).delete().eq("id", id), 15000, "Removing entry"),
        "Removing entry",
      );
      return true;
    } catch (error) {
      throw asAppError(error, "Couldn't remove that entry.");
    }
  }

  // ---- availability -------------------------------------------------------

  static async getAvailability(employeeId, fromDate) {
    try {
      const [weeklyRes, datesRes] = await Promise.all([
        withTimeout(
          supabase.from(WEEKLY).select("*").eq("employee_id", employeeId),
          15000,
          "Loading availability",
        ),
        withTimeout(
          supabase
            .from(DATES)
            .select("*")
            .eq("employee_id", employeeId)
            .gte("on_date", fromDate)
            .order("on_date", { ascending: true }),
          15000,
          "Loading availability",
        ),
      ]);
      const weekly = (unwrap(weeklyRes, "Loading availability") || []).map((r) => ({
        weekday: r.weekday,
        available: r.available !== false,
        fromTime: hhmm(r.from_time),
        toTime: hhmm(r.to_time),
      }));
      const exceptions = (unwrap(datesRes, "Loading availability") || []).map((r) => ({
        onDate: r.on_date,
        available: r.available !== false,
        fromTime: hhmm(r.from_time),
        toTime: hhmm(r.to_time),
        note: r.note || "",
      }));
      return { weekly, exceptions };
    } catch (error) {
      throw asAppError(error, "Couldn't load availability.");
    }
  }

  // Everyone's availability across a date range — the admin's consolidated
  // view. Two queries rather than one per person: a roster of ten would
  // otherwise be twenty round trips before the screen could draw.
  //
  // Weekly patterns are not date-filtered because they have no dates; they are
  // the fallback for every day nobody answered explicitly.
  static async getAvailabilityRange(fromDate, toDate) {
    try {
      const [weeklyRes, datesRes] = await Promise.all([
        withTimeout(supabase.from(WEEKLY).select("*"), 15000, "Loading availability"),
        withTimeout(
          supabase
            .from(DATES)
            .select("*")
            .gte("on_date", fromDate)
            .lte("on_date", toDate)
            .order("on_date", { ascending: true }),
          15000,
          "Loading availability",
        ),
      ]);
      const weekly = (unwrap(weeklyRes, "Loading availability") || []).map((r) => ({
        employeeId: r.employee_id,
        weekday: r.weekday,
        available: r.available !== false,
        fromTime: hhmm(r.from_time),
        toTime: hhmm(r.to_time),
      }));
      const exceptions = (unwrap(datesRes, "Loading availability") || []).map((r) => ({
        employeeId: r.employee_id,
        onDate: r.on_date,
        available: r.available !== false,
        fromTime: hhmm(r.from_time),
        toTime: hhmm(r.to_time),
        note: r.note || "",
      }));
      return { weekly, exceptions };
    } catch (error) {
      throw asAppError(error, "Couldn't load availability.");
    }
  }

  // Upsert, not insert: a weekday is set repeatedly as someone changes their
  // mind, and the primary key is (employee_id, weekday).
  static async setWeekly(employeeId, weekday, value) {
    try {
      unwrap(
        await withTimeout(
          supabase.from(WEEKLY).upsert(
            {
              employee_id: employeeId,
              weekday,
              available: value.available !== false,
              from_time: value.fromTime || null,
              to_time: value.toTime || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "employee_id,weekday" },
          ),
          15000,
          "Saving availability",
        ),
        "Saving availability",
      );
      return true;
    } catch (error) {
      throw asAppError(error, "Couldn't save availability.");
    }
  }

  static async setDate(employeeId, onDate, value) {
    try {
      unwrap(
        await withTimeout(
          supabase.from(DATES).upsert(
            {
              employee_id: employeeId,
              on_date: onDate,
              available: value.available !== false,
              from_time: value.fromTime || null,
              to_time: value.toTime || null,
              note: String(value.note || "").slice(0, 200),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "employee_id,on_date" },
          ),
          15000,
          "Saving availability",
        ),
        "Saving availability",
      );
      return true;
    } catch (error) {
      throw asAppError(error, "Couldn't save availability.");
    }
  }

  // Several dates at once — "I usually work Tuesdays" filling in the Tuesdays.
  // One upsert rather than a request per date: nine round trips from a phone
  // on restaurant wifi is long enough to tap something else halfway through.
  static async setDates(employeeId, dates, value) {
    if (!dates || dates.length === 0) return true;
    try {
      const now = new Date().toISOString();
      unwrap(
        await withTimeout(
          supabase.from(DATES).upsert(
            dates.map((onDate) => ({
              employee_id: employeeId,
              on_date: onDate,
              available: value.available !== false,
              from_time: value.fromTime || null,
              to_time: value.toTime || null,
              note: String(value.note || "").slice(0, 200),
              updated_at: now,
            })),
            { onConflict: "employee_id,on_date" },
          ),
          20000,
          "Saving availability",
        ),
        "Saving availability",
      );
      return true;
    } catch (error) {
      throw asAppError(error, "Couldn't save those days.");
    }
  }

  // Un-ticking a usual weekday: remove the answers it had filled in. One
  // delete for the lot, matching setDates.
  static async clearDates(employeeId, dates) {
    if (!dates || dates.length === 0) return true;
    try {
      unwrap(
        await withTimeout(
          supabase.from(DATES).delete().eq("employee_id", employeeId).in("on_date", dates),
          20000,
          "Saving availability",
        ),
        "Saving availability",
      );
      return true;
    } catch (error) {
      throw asAppError(error, "Couldn't clear those days.");
    }
  }

  // Clearing an exception restores the weekly pattern for that date, which is
  // why this deletes rather than writing available = true.
  static async clearDate(employeeId, onDate) {
    try {
      unwrap(
        await withTimeout(
          supabase.from(DATES).delete().eq("employee_id", employeeId).eq("on_date", onDate),
          15000,
          "Saving availability",
        ),
        "Saving availability",
      );
      return true;
    } catch (error) {
      throw asAppError(error, "Couldn't clear that day.");
    }
  }

  // ---- PIN ----------------------------------------------------------------

  // Verification happens in the database so the hash never reaches the client.
  // An employee with no PIN set passes: adding the feature must not lock out
  // everyone until every PIN has been issued.
  static async verifyPin(employeeId, pin) {
    try {
      const data = unwrap(
        await withTimeout(
          supabase.rpc("verify_employee_pin", { p_employee_id: employeeId, p_pin: String(pin || "") }),
          15000,
          "Checking PIN",
        ),
        "Checking PIN",
      );
      return data === true;
    } catch (error) {
      throw asAppError(error, "Couldn't check that PIN.");
    }
  }

  // Whether a PIN exists at all — decides between "enter yours" and "choose
  // one". Never returns the hash. An unknown id comes back null; treated as
  // "already has one" so a strange id lands on the safer screen.
  static async hasPin(employeeId) {
    try {
      const data = unwrap(
        await withTimeout(
          supabase.rpc("employee_has_pin", { p_employee_id: employeeId }),
          15000,
          "Checking PIN",
        ),
        "Checking PIN",
      );
      return data !== false;
    } catch (error) {
      throw asAppError(error, "Couldn't check that name.");
    }
  }

  // A person setting their own PIN for the first time. The database only lets
  // this write where none exists, so it can never overwrite someone else's.
  // False means one was already set between loading the screen and pressing
  // save — rare, but it is a race and it is handled rather than assumed away.
  static async claimPin(employeeId, pin) {
    try {
      const data = unwrap(
        await withTimeout(
          supabase.rpc("claim_employee_pin", {
            p_employee_id: employeeId,
            p_pin: String(pin || ""),
          }),
          15000,
          "Saving PIN",
        ),
        "Saving PIN",
      );
      return data === true;
    } catch (error) {
      throw asAppError(error, "Couldn't save that PIN.");
    }
  }

  static async setPin(employeeId, pin) {
    try {
      unwrap(
        await withTimeout(
          supabase.rpc("set_employee_pin", { p_employee_id: employeeId, p_pin: pin ?? null }),
          15000,
          "Saving PIN",
        ),
        "Saving PIN",
      );
      return true;
    } catch (error) {
      throw asAppError(error, "Couldn't save that PIN.");
    }
  }
}

export default TimesheetRepository;
