// src/repositories/StockCountRepository.js
//
// A month's closing count is now NORMALISED: a header row in `stock_counts`
// plus one row per item in `stock_count_lines`. The app still works with a
// `lines` map (itemId -> number), so this repository is the single place that
// translates between that map and the line rows:
//   - READS rebuild the map from stock_count_lines.
//   - WRITES go through the save_stock_count() RPC, which upserts the header and
//     replaces the lines in one atomic, RLS-enforcing transaction.
import { supabase, withTimeout, unwrap, toTs } from "../supabase.js";
import { prevMonthId } from "../utils/monthUtils.js";
import { buildPayload } from "../models/StockCountModel.js";

const COUNTS = "stock_counts"; // header, primary key = "YYYY-MM"
const LINES = "stock_count_lines"; // (month_id, item_id, qty)

// Header row (+ its lines map) -> app object. `id` mirrors `monthId` so the UI
// keeps working. Timestamps become { seconds } shapes.
function fromRow(r, lines = {}) {
  if (!r) return null;
  return {
    id: r.month_id,
    monthId: r.month_id,
    reporter: r.reporter || "",
    status: r.status || "draft",
    lines: lines || {},
    createdAt: toTs(r.created_at),
    updatedAt: toTs(r.updated_at),
    submittedAt: toTs(r.submitted_at),
    finalizedAt: toTs(r.finalized_at),
  };
}

// Fetch the lines for one month as a { itemId: qty } map.
async function linesForMonth(monthId) {
  const rows = unwrap(
    await withTimeout(
      supabase.from(LINES).select("item_id, qty").eq("month_id", monthId),
      15000,
      "Loading counts",
    ),
    "Loading counts",
  );
  const map = {};
  for (const row of rows || []) map[row.item_id] = Number(row.qty);
  return map;
}

// Fetch the lines for several months at once -> { monthId: { itemId: qty } }.
async function linesForMonths(monthIds) {
  if (!monthIds.length) return {};
  const rows = unwrap(
    await withTimeout(
      supabase.from(LINES).select("month_id, item_id, qty").in("month_id", monthIds),
      15000,
      "Loading counts",
    ),
    "Loading counts",
  );
  const byMonth = {};
  for (const row of rows || []) {
    (byMonth[row.month_id] ||= {})[row.item_id] = Number(row.qty);
  }
  return byMonth;
}

export class StockCountRepository {
  // Fetch a single month's count (or null if it doesn't exist yet).
  static async getMonth(monthId) {
    const header = unwrap(
      await withTimeout(
        supabase.from(COUNTS).select("*").eq("month_id", monthId).maybeSingle(),
        15000,
        "Loading month",
      ),
      "Loading month",
    );
    if (!header) return null;
    const lines = await linesForMonth(monthId);
    return fromRow(header, lines);
  }

  // The previous month's closing quantities, keyed by itemId. {} if none.
  static async getPrevClosing(monthId) {
    const prev = await StockCountRepository.getMonth(prevMonthId(monthId));
    if (!prev || !prev.lines) return {};
    return { ...prev.lines };
  }

  // Create or overwrite a month's count. The RPC upserts the header and replaces
  // stock_count_lines atomically; status moves draft -> submitted -> finalized.
  static async saveMonth({ monthId, reporter, status, counts }) {
    const payload = buildPayload({ monthId, reporter, status, counts });
    unwrap(
      await withTimeout(
        supabase.rpc("save_stock_count", {
          p_month_id: payload.monthId,
          p_reporter: payload.reporter,
          p_status: payload.status,
          p_lines: payload.lines,
        }),
        20000,
        "Saving month",
      ),
      "Saving month",
    );
    return { id: monthId };
  }

  // Change only the status of a month (admin finalize / reopen) — header only.
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
    const headers = unwrap(
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
    const byMonth = await linesForMonths((headers || []).map((h) => h.month_id));
    return (headers || []).map((h) => fromRow(h, byMonth[h.month_id] || {}));
  }

  // Fetch several months in a range (inclusive) for trend comparisons.
  static async getMonthsInRange(startMonthId, endMonthId) {
    const headers = unwrap(
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
    const byMonth = await linesForMonths((headers || []).map((h) => h.month_id));
    return (headers || []).map((h) => fromRow(h, byMonth[h.month_id] || {}));
  }
}
