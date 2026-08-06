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
import { displayQty } from "./unitScale.js";
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

// The category / sub-category label an item is grouped under in the exports.
// One string rather than two columns: it reads as a single "where in the shop"
// indicator, which is what the person walking the aisles actually wants.
// The separator is a plain ASCII slash on purpose: fancier glyphs like "›"
// (U+203A) are outside the bundled PDF font subset and would silently vanish.
export function groupOf(item) {
  const cat = (item.category || "").trim();
  const sub = (item.subCategory || "").trim();
  if (cat && sub) return `${cat} / ${sub}`;
  return cat || sub || UNGROUPED;
}

export const UNGROUPED = "Other";

// Ordered items, optionally narrowed to a selection of order types and with
// individual items excluded. Sorted order type -> category -> sub-category ->
// item name, so rows arrive already grouped for both exports.
//
// `selected`   — order types to include; array or Set. null/undefined = all.
// `excludedIds`— item ids to leave OUT of this export; array or Set.
//
// Both are EXPORT-TIME filters only. They never touch `lines`, so unticking an
// item here changes the file and nothing else — the submitted order is
// unaffected.
export function selectOrderRows(items, lines, selected, excludedIds) {
  const only = selected == null ? null : new Set(selected);
  const skip = excludedIds == null ? null : new Set(excludedIds);
  return items
    .filter((item) => isOrdered(lines?.[item.id]))
    .map((item) => ({
      item,
      orderType: orderTypeOf(item),
      group: groupOf(item),
      line: lines[item.id],
    }))
    .filter((r) => !only || only.has(r.orderType))
    .filter((r) => !skip || !skip.has(r.item.id))
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
// Columns: Order type, Group, Item, Quantity, Unit, Note.
// "Group" is the category › sub-category indicator; rows arrive sorted by it so
// the sheet is already grouped, and the column tells you which group a row
// belongs to (and lets you pivot / filter on it in a spreadsheet). Order ref and
// status are omitted — the ref is already in the filename. Only items on the
// order (qty > 0) are exported, and only those whose order type is in `selected`
// (null = all), minus any id in `excludedIds`.
// `order` is unused by the body but kept in the signature so callers stay
// uniform with downloadOrderCsv / the PDF builder.
export function buildOrderCsv(order, items, lines, selected = null, excludedIds = null) {
  const header = ["Order type", "Group", "Item", "Quantity", "Unit", "Note"];

  const ordered = selectOrderRows(items, lines, selected, excludedIds);

  const rows = [header];
  for (const { item, orderType, group, line } of ordered) {
    // Sub-kilo lines are written as grams, matching the PDF.
    const shown = displayQty(orderNum(line.qty), orderUnitOf(item));
    rows.push([
      orderType,
      group,
      item.name,
      shown.qty,
      shown.unit,
      line.note || "",
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

// Download / share an order CSV, optionally limited to selected order types
// and with individual items excluded.
export async function downloadOrderCsv(order, items, lines, selected = null, excludedIds = null) {
  const ref = orderRef(order);
  const csv = buildOrderCsv(order, items, lines, selected, excludedIds);
  await shareOrDownload(csv, `${ref}.csv`, `Order ${ref}`);
}
