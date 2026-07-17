// src/models/ReceiptModel.js
//
// Pure logic for received-stock batches. Each receipt is ONE batch of an item
// with its own expiry date, so an item can have several receipts with different
// expiries (e.g. 10 bottles expiring this month, 20 next month). No React /
// Firebase imports.
import { todayStr, shiftDateStr, diffDays, monthOf } from "../utils/monthUtils.js";
import { currentMonthId, shiftMonthId } from "../utils/monthUtils.js";

export const MAX_QTY = 1_000_000;

export function num(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 1000) / 1000;
}

export function isValidDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Whole days from today until the expiry (negative = already expired).
export function daysLeft(expiry, today = todayStr()) {
  if (!isValidDate(expiry)) return null;
  return diffDays(today, expiry);
}

// Expiry-window filters offered to the admin.
export const WINDOWS = ["expired", "thisMonth", "next30", "nextMonth", "next2Months"];

// Does an expiry date fall in the given window?
export function inWindow(expiry, win, today = todayStr()) {
  if (!isValidDate(expiry)) return false;
  const cur = currentMonthId();
  const m = monthOf(expiry);
  switch (win) {
    case "expired":
      return expiry < today;
    case "next30":
      return expiry >= today && expiry <= shiftDateStr(today, 30);
    case "thisMonth":
      return m === cur && expiry >= today;
    case "nextMonth":
      return m === shiftMonthId(cur, 1);
    case "next2Months":
      // This month, next, and the month after — upcoming only.
      return (
        expiry >= today &&
        (m === cur || m === shiftMonthId(cur, 1) || m === shiftMonthId(cur, 2))
      );
    default:
      return false;
  }
}

export function validate({ itemId, qty, expiry }) {
  const errors = [];
  if (!itemId) errors.push("Pick an item.");
  if (num(qty) <= 0) errors.push("Enter a quantity greater than 0.");
  if (num(qty) > MAX_QTY) errors.push("Quantity is too large.");
  if (!isValidDate(expiry)) errors.push("Pick a valid expiry date.");
  return { ok: errors.length === 0, errors };
}

// The persisted payload for a receipt (item details denormalized for the
// expiry view + resilience if the item is later renamed).
export function buildPayload({ item, qty, expiry, reporter }) {
  return {
    itemId: item.id,
    itemName: item.name || "",
    unit: item.unit || "",
    category: item.category || "",
    subCategory: item.subCategory || "",
    qty: num(qty),
    expiry,
    reporter: String(reporter || "").slice(0, 120),
  };
}
