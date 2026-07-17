// src/models/OrderModel.js
//
// Pure logic for a purchase ORDER. Staff build one running draft over several
// days (each line = a quantity to order + an optional note), then submit it;
// admins can review, modify, and export. No React / Firebase imports.
//
// Working state ("lines") is a map  itemId -> { qty, note }  where qty is the
// raw input (""/0 = not on the order) and note is free text. Persisted lines is
// a clean map  itemId -> { qty:number, note:string }  for items with qty > 0.

export const MAX_QTY = 1_000_000;
export const MAX_NOTE = 200;
export const QTY_DECIMALS = 3;

export const STATUS = {
  DRAFT: "draft", // being built by staff (the running order)
  SUBMITTED: "submitted", // sent for admin review
};

export function num(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  const f = Math.pow(10, QTY_DECIMALS);
  return Math.round(n * f) / f;
}

// An item is on the order when its quantity is greater than zero.
export function isOrdered(line) {
  return num(line?.qty) > 0;
}

export function normalizeLine(line = {}) {
  return {
    qty: num(line.qty),
    note: String(line.note || "").slice(0, MAX_NOTE),
  };
}

// Load a persisted lines map into editable working lines.
export function toLines(saved = {}) {
  const out = {};
  for (const [id, line] of Object.entries(saved || {})) {
    out[id] = { qty: line?.qty ?? "", note: line?.note ?? "" };
  }
  return out;
}

// Reduce working lines to the clean persisted map (only items on the order).
export function cleanLines(lines = {}) {
  const out = {};
  for (const [id, line] of Object.entries(lines)) {
    if (isOrdered(line)) {
      out[id] = {
        qty: num(line.qty),
        note: String(line.note || "").trim().slice(0, MAX_NOTE),
      };
    }
  }
  return out;
}

export function validateLines(lines = {}) {
  const errors = [];
  for (const [id, line] of Object.entries(lines)) {
    if (!isOrdered(line)) continue;
    if (num(line.qty) > MAX_QTY) errors.push({ itemId: id, message: "quantity too large" });
    if (String(line.note || "").length > MAX_NOTE)
      errors.push({ itemId: id, message: "note too long" });
  }
  return { ok: errors.length === 0, errors };
}

// Progress summary for the order: how many items are on it, per category too.
export function summarize(items = [], lines = {}) {
  let onOrder = 0;
  const byCategory = {};
  const bySub = {};
  for (const item of items) {
    const cat = item.category || "Uncategorized";
    const sub = item.subCategory || "Other";
    byCategory[cat] = byCategory[cat] || { onOrder: 0, total: 0 };
    byCategory[cat].total += 1;
    bySub[cat] = bySub[cat] || {};
    bySub[cat][sub] = bySub[cat][sub] || { onOrder: 0, total: 0 };
    bySub[cat][sub].total += 1;
    if (isOrdered(lines[item.id])) {
      onOrder += 1;
      byCategory[cat].onOrder += 1;
      bySub[cat][sub].onOrder += 1;
    }
  }
  return { totalItems: items.length, onOrder, byCategory, bySub };
}

// The unit an item is ordered in — a saved preference (orderUnit) that falls
// back to the item's stock unit. Used for order display + CSV, not for stock.
export function orderUnitOf(item) {
  return (item && (item.orderUnit || item.unit)) || "";
}

export function buildPayload({ reporter, status, lines }) {
  return {
    reporter: String(reporter || "").slice(0, 120),
    status: Object.values(STATUS).includes(status) ? status : STATUS.DRAFT,
    lines: cleanLines(lines),
  };
}
