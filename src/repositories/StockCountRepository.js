// src/repositories/StockCountRepository.js
import { supabase, withTimeout, unwrap, toTs } from "../supabase.js";
import { prevMonthId } from "../utils/monthUtils.js";
import { buildPayload } from "../models/StockCountModel.js";

const COUNTS = "stock_counts"; // one row per month, primary key = "YYYY-MM"

// DB row -> app object. `id` mirrors `monthId` so the UI (which used the
// Firestore doc id) keeps working. Timestamps become { seconds } shapes.
function fromRow(r) {
  if (!r) return null;
  return {
    id: r.month_id,
    monthId: r.month_id,
    reporter: r.reporter || "",
    status: r.status || "draft",
    lines: r.lines || {},
    createdAt: toTs(r.created_at),
    updatedAt: toTs(r.updated_at),
    submittedAt: toTs(r.submitted_at),
    finalizedAt: toTs(r.finalized_at),
  };
}

export class StockCountRepository {
  // Fetch a single month's count (or null if it doesn't exist yet).
  static async getMonth(monthId) {
    const data = unwrap(
      await withTimeout(
        supabase.from(COUNTS).select("*").eq("month_id", monthId).maybeSingle(),
        15000,
        "Loading month",
      ),
      "Loading month",
    );
    return fromRow(data);
  }

  // The previous month's closing quantities, keyed by itemId. {} if none.
  static async getPrevClosing(monthId) {
    const prev = await StockCountRepository.getMonth(prevMonthId(monthId));
    if (!prev || !prev.lines) return {};
    return { ...prev.lines };
  }

  // Create or overwrite a month's count. Uses the monthId as the primary key so
  // a month can never be duplicated. status moves draft -> submitted -> finalized.
  static async saveMonth({ monthId, reporter, status, counts }) {
    const payload = buildPayload({ monthId, reporter, status, counts });
    const now = new Date().toISOString();
    const row = {
      month_id: payload.monthId,
      reporter: payload.reporter,
      status: payload.status,
      lines: payload.lines,
      updated_at: now,
      ...(status === "submitted" ? { submitted_at: now } : {}),
      ...(status === "finalized" ? { finalized_at: now } : {}),
    };
    unwrap(
      await withTimeout(
        supabase.from(COUNTS).upsert(row, { onConflict: "month_id" }),
        20000,
        "Saving month",
      ),
      "Saving month",
    );
    return { id: monthId };
  }

  // Change only the status of a month (admin finalize / reopen).
  static async setStatus(monthId, status) {
    const now = new Date().toISOString();
    unwrap(
      await withTimeout(
        supabase
          .from(COUNTS)
          .update({
            status,
            updated_at: now,
            ...(status === "finalized" ? { finalized_at: now } : {}),
          })
          .eq("month_id", monthId),
        15000,
        "Updating status",
      ),
      "Updating status",
    );
    return true;
  }

  // List recent months (newest first) for the admin month picker / history.
  static async listMonths(limitCount = 24) {
    const data = unwrap(
      await withTimeout(
        supabase
          .from(COUNTS)
          .select("*")
          .order("month_id", { ascending: false })
          .limit(limitCount),
        15000,
        "Loading months",
      ),
      "Loading months",
    );
    return (data || []).map(fromRow);
  }

  // Fetch several months in a range (inclusive) for trend comparisons.
  static async getMonthsInRange(startMonthId, endMonthId) {
    const data = unwrap(
      await withTimeout(
        supabase
          .from(COUNTS)
          .select("*")
          .gte("month_id", startMonthId)
          .lte("month_id", endMonthId)
          .order("month_id", { ascending: false }),
        15000,
        "Loading months",
      ),
      "Loading months",
    );
    return (data || []).map(fromRow);
  }
}
