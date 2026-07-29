// src/utils/exportCsv.js
// Build a CSV of a month's CLOSING counts and trigger a browser download.
//
// The export is meant to be imported into SupplyTracker, which keys stock on
// the unique item NAME and records a dated stock count. Columns:
//   Item, Closing, Unit, Count Date, Month, Category, Sub-category
// - "Item" is the join key (matches SupplyTracker's Item.name).
// - "Count Date" is the month-end date (SupplyTracker `happened_at`).
// Only items that were actually counted are exported.
import { isCounted, num } from "../models/StockCountModel.js";
import { isOrdered, num as orderNum, orderUnitOf } from "../models/OrderModel.js";
import { monthEndDate } from "./monthUtils.js";

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildMonthCsv(monthId, items, counts) {
  const header = [
    "Item",
    "Closing",
    "Unit",
    "Count Date",
    "Month",
    "Category",
    "Sub-category",
  ];
  const countDate = monthEndDate(monthId);
  const rows = [header];
  for (const item of items) {
    const v = counts?.[item.id];
    if (!isCounted(v)) continue;
    rows.push([
      item.name,
      num(v),
      item.unit || "",
      countDate,
      monthId,
      item.category || "",
      item.subCategory || "",
    ]);
  }
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

// ---------------------------------------------------------------------------
// The label used for an item with no order type set. Shared by the CSV and PDF
// exports so the two always group items the same way.
export const UNASSIGNED = "Unassigned";

export function orderTypeOf(item) {
  return (item.orderType || "").trim() || UNASSIGNED;
}

// The order types actually present on an order, sorted — powers the export
// filter UI so admins only ever see types they can really export.
export function orderTypesOnOrder(items, lines) {
  const set = new Set();
  for (const item of items) if (isOrdered(lines?.[item.id])) set.add(orderTypeOf(item));
  return [...set].sort((a, b) => a.localeCompare(b));
}

// Ordered items, optionally narrowed to a selection of order types, sorted by
// order type -> category -> sub-category -> name. `selected` may be an array or
// a Set; null/undefined means "no filter, export everything".
export function selectOrderRows(items, lines, selected) {
  const only = selected == null ? null : new Set(selected);
  return items
    .filter((item) => isOrdered(lines?.[item.id]))
    .map((item) => ({ item, orderType: orderTypeOf(item), line: lines[item.id] }))
    .filter((r) => !only || only.has(r.orderType))
    .sort(
      (a, b) =>
        a.orderType.localeCompare(b.orderType) ||
        (a.item.category || "").localeCompare(b.item.category || "") ||
        (a.item.subCategory || "").localeCompare(b.item.subCategory || "") ||
        a.item.name.localeCompare(b.item.name),
    );
}

// ---------------------------------------------------------------------------
// ORDER CSV
// Columns: Order type, Item, Quantity, Unit, Note, Category, Sub-category,
// Order ref, Status. Only items on the order (qty > 0) are exported, and only
// those whose order type is in `selected` (null = all).
export function buildOrderCsv(order, items, lines, selected = null) {
  const header = [
    "Order type",
    "Item",
    "Quantity",
    "Unit",
    "Note",
    "Category",
    "Sub-category",
    "Order ref",
    "Status",
  ];
  const ref = orderRef(order);
  const status = order?.status || "draft";

  const ordered = selectOrderRows(items, lines, selected);

  const rows = [header];
  for (const { item, orderType, line } of ordered) {
    rows.push([
      orderType,
      item.name,
      orderNum(line.qty),
      orderUnitOf(item),
      line.note || "",
      item.category || "",
      item.subCategory || "",
      ref,
      status,
    ]);
  }
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

// A short human reference for an order (date + last 4 of id).
export function orderRef(order) {
  if (!order) return "ORDER";
  const ts = order.submittedAt?.seconds || order.createdAt?.seconds;
  const date = ts ? new Date(ts * 1000).toISOString().slice(0, 10) : "draft";
  const tail = String(order.id || "").slice(-4);
  return `ORD-${date}-${tail}`;
}

// eslint-disable-next-line no-unused-vars
async function shareOrDownload(csv, filename, _title) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Download / share a month's closing-stock CSV.
export async function downloadMonthCsv(monthId, items, counts) {
  const csv = buildMonthCsv(monthId, items, counts);
  await shareOrDownload(csv, `closing-stock-${monthId}.csv`, `Closing stock ${monthId}`);
}

// Download / share an order CSV, optionally limited to selected order types.
export async function downloadOrderCsv(order, items, lines, selected = null) {
  const ref = orderRef(order);
  const csv = buildOrderCsv(order, items, lines, selected);
  await shareOrDownload(csv, `${ref}.csv`, `Order ${ref}`);
}
