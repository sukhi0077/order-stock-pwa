// src/models/StockCountModel.js
//
// Pure logic for a monthly CLOSING stock count. This app captures ONE number
// per item: the physical closing quantity at month-end. Opening / received /
// used are tracked downstream in SupplyTracker — this app only feeds it the
// closing counts (via CSV export).
//
// No React / Firebase imports, so the whole layer is unit-testable with plain
// node or Vitest.
//
// Working state ("counts") is a map  itemId -> value  where value is whatever
// the input holds: "" / undefined = NOT counted, and any entry (including "0")
// = counted. Persisted `lines` is a clean map  itemId -> number  (0 kept).

export const MAX_QTY = 1_000_000;
export const QTY_DECIMALS = 3;

export const STATUS = {
  DRAFT: "draft", // being entered
  SUBMITTED: "submitted", // staff finished, awaiting admin review
  FINALIZED: "finalized", // locked by admin (month closed)
};

// Coerce any input to a finite, non-negative number rounded to QTY_DECIMALS.
export function num(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  const f = Math.pow(10, QTY_DECIMALS);
  return Math.round(n * f) / f;
}

// Has this item been given a closing value? A typed "0" counts; blank does not.
export function isCounted(v) {
  return v !== undefined && v !== null && String(v).trim() !== "";
}

// Load a persisted lines map (itemId -> number) into editable working counts.
export function toCounts(lines = {}) {
  const out = {};
  for (const [id, v] of Object.entries(lines || {})) out[id] = v;
  return out;
}

// Reduce working counts to the clean persisted map (only counted items, 0 kept).
export function cleanClosings(counts = {}) {
  const out = {};
  for (const [id, v] of Object.entries(counts)) {
    if (isCounted(v)) out[id] = num(v);
  }
  return out;
}

// Validate the entered closings. Returns { ok, errors: [{itemId, message}] }.
export function validateClosings(counts = {}) {
  const errors = [];
  for (const [id, v] of Object.entries(counts)) {
    if (!isCounted(v)) continue;
    const n = num(v);
    if (n > MAX_QTY) errors.push({ itemId: id, message: "exceeds the maximum" });
  }
  return { ok: errors.length === 0, errors };
}

// Progress summary: how many items are counted, per category too.
export function summarizeClosings(items = [], counts = {}) {
  let counted = 0;
  const byCategory = {};
  for (const item of items) {
    const cat = item.category || "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = { counted: 0, total: 0 };
    byCategory[cat].total += 1;
    if (isCounted(counts[item.id])) {
      counted += 1;
      byCategory[cat].counted += 1;
    }
  }
  return {
    totalItems: items.length,
    counted,
    remaining: items.length - counted,
    byCategory,
  };
}

// The persisted payload for a month (rules validate a subset of this).
export function buildPayload({ monthId, reporter, status, counts }) {
  return {
    monthId,
    reporter: String(reporter || "").slice(0, 120),
    status: Object.values(STATUS).includes(status) ? status : STATUS.DRAFT,
    lines: cleanClosings(counts),
  };
}
