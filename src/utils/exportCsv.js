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
// ORDER CSV
// Columns: Item, Quantity, Unit, Note, Category, Sub-category, Order ref, Status
// Only items on the order (qty > 0) are exported.
export function buildOrderCsv(order, items, lines) {
  const header = [
    "Supplier",
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

  // Only ordered items, sorted by supplier -> category -> sub-category
  // (-> name as a final tiebreaker) so the owner sees clearly what to order
  // from each supplier.
  const ordered = items
    .filter((item) => isOrdered(lines?.[item.id]))
    .map((item) => ({ item, supplier: (item.supplier || "").trim() || "Unassigned" }))
    .sort(
      (a, b) =>
        a.supplier.localeCompare(b.supplier) ||
        (a.item.category || "").localeCompare(b.item.category || "") ||
        (a.item.subCategory || "").localeCompare(b.item.subCategory || "") ||
        a.item.name.localeCompare(b.item.name),
    );

  const rows = [header];
  for (const { item, supplier } of ordered) {
    const line = lines[item.id];
    rows.push([
      supplier,
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

// Download / share an order CSV.
export async function downloadOrderCsv(order, items, lines) {
  const ref = orderRef(order);
  const csv = buildOrderCsv(order, items, lines);
  await shareOrDownload(csv, `${ref}.csv`, `Order ${ref}`);
}
