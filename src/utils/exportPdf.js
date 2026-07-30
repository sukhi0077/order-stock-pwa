// src/utils/exportPdf.js
// Order sheet -> a REAL .pdf file, built with jsPDF + autoTable.
//
// This deliberately does NOT go through the browser's print dialog. Printing
// stamps the page URL and a timestamp into the paper margins (the browser's own
// header/footer, which no CSS can remove) and costs an extra "Save as PDF" tap.
// Generating the file directly gives a clean sheet and a one-tap download.
//
// The sheet groups items by ORDER TYPE — one banded section per type — because
// that is how the orders are actually placed.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { orderRef, selectOrderRows } from "./exportCsv.js";
import { num as orderNum, orderUnitOf } from "../models/OrderModel.js";
import { LIBERATION_SANS_REGULAR, LIBERATION_SANS_BOLD } from "../fonts/liberationSans.js";

// Business letterhead printed at the top of every order sheet.
const BUSINESS = {
  name: "Misa Hindusa Poznan",
  address: "Szamarzewskiego 14, 60-516 Poznań",
  nip: "NIP 9241799529",
};

const FONT = "LiberationSans";
const TEAL = [13, 148, 136];
const INK = [15, 23, 42];
const MUTED = [71, 85, 105];
const FAINT = [148, 163, 184];
const LINE = [226, 232, 240];
const MARGIN = 14; // mm

// jsPDF's built-in fonts are WinAnsi-only, so Polish characters would come out
// as garbage. Register the bundled Unicode subset once per document.
function registerUnicodeFont(doc) {
  doc.addFileToVFS("LiberationSans-Regular.ttf", LIBERATION_SANS_REGULAR);
  doc.addFont("LiberationSans-Regular.ttf", FONT, "normal");
  doc.addFileToVFS("LiberationSans-Bold.ttf", LIBERATION_SANS_BOLD);
  doc.addFont("LiberationSans-Bold.ttf", FONT, "bold");
  doc.setFont(FONT, "normal");
}

// Group the selected rows into [{ orderType, rows }] preserving sort order.
function groupByOrderType(rows) {
  const groups = [];
  let current = null;
  for (const r of rows) {
    if (!current || current.orderType !== r.orderType) {
      current = { orderType: r.orderType, rows: [] };
      groups.push(current);
    }
    current.rows.push(r);
  }
  return groups;
}

// The order's own date — when it was submitted, else when it was created,
// else today. That is the date the order was actually placed, which is what a
// supplier or a later audit cares about; it is not the date the file was made.
function orderDate(order) {
  const ts = order?.submittedAt?.seconds || order?.createdAt?.seconds;
  const d = ts ? new Date(ts * 1000) : new Date();
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Draw the letterhead; returns the y content should start at.
// Business details sit left, the order reference and date right, on the same
// two lines so the block stays compact.
function drawLetterhead(doc, order) {
  const right = doc.internal.pageSize.getWidth() - MARGIN;
  let y = MARGIN;

  doc.setFont(FONT, "bold").setFontSize(15).setTextColor(...INK);
  doc.text(BUSINESS.name, MARGIN, y);
  doc.setFontSize(10);
  doc.text(orderRef(order), right, y, { align: "right" });

  y += 5;
  doc.setFont(FONT, "normal").setFontSize(9).setTextColor(...MUTED);
  doc.text(`${BUSINESS.address} · ${BUSINESS.nip}`, MARGIN, y);
  doc.text(orderDate(order), right, y, { align: "right" });

  y += 3;
  doc.setDrawColor(...INK).setLineWidth(0.5);
  doc.line(MARGIN, y, right, y);
  return y + 6;
}

// The order-type band that sits above each table; returns the next y.
function drawSectionHeading(doc, label, count, y) {
  const pageW = doc.internal.pageSize.getWidth();
  const h = 6.5;
  doc.setFillColor(241, 245, 249);
  doc.rect(MARGIN, y, pageW - MARGIN * 2, h, "F");
  doc.setFillColor(...TEAL);
  doc.rect(MARGIN, y, 1.2, h, "F");
  doc.setFont(FONT, "bold").setFontSize(9).setTextColor(...INK);
  doc.text(String(label).toUpperCase(), MARGIN + 3.5, y + 4.5);
  doc.setFont(FONT, "normal").setTextColor(...MUTED);
  doc.text(String(count), pageW - MARGIN - 3, y + 4.5, { align: "right" });
  return y + h + 2;
}

// The sheet's CONTENT, separated from its rendering.
//
// Extracted so the document can be asserted on in tests: jsPDF writes text as
// subset glyph IDs, not characters, so the finished PDF cannot be read back
// without the font's cmap. Everything worth testing — which sections exist,
// their order and counts, row numbering, what each row says — lives here, and
// the renderer below is a thin drawing pass over it.
export function buildOrderSheet(order, items, lines, selected = null, excludedIds = null) {
  const groups = groupByOrderType(selectOrderRows(items, lines, selected, excludedIds));
  return {
    business: BUSINESS,
    ref: orderRef(order),
    date: orderDate(order),
    sections: groups.map((g) => ({
      orderType: g.orderType,
      count: g.rows.length,
      rows: g.rows.map((r, i) => ({
        n: i + 1,
        name: r.item.name,
        qty: orderNum(r.line.qty),
        unit: orderUnitOf(r.item),
        note: r.line.note || "",
        group: r.group,
      })),
    })),
  };
}

// One body row per item — no group heading rows.
//
// Group headings used to sit above each run of rows, but most category /
// sub-category groups on a real order hold a SINGLE item, so the headings ended
// up outnumbering and visually outweighing the items they labelled. The group
// is now just a quiet right-hand column, which costs nothing for a one-item
// group and keeps the item name the thing your eye lands on.
//
// Item numbers run continuously through the order-type section, so the last
// number is also the section's item count.
function bodyRows(rows) {
  return rows.map((r) => [
    String(r.n),
    r.name,
    String(r.qty),
    r.unit,
    r.note,
    r.group,
    "",
  ]);
}

// Column index of the tick-box gutter — last column, kept as a name so the
// hooks below don't drift if the column list changes.
const TICK_COL = 6;

// Shared autoTable config. Row padding is tight so the sheet stays compact.
function tableOptions(doc, rows, startY) {
  return {
    startY,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN },
    // Last column is the tick box; its header stays blank because Liberation
    // Sans has no U+2713 glyph and a missing glyph renders as a box in some
    // viewers. The empty column reads fine as a checklist gutter.
    head: [["#", "Item", "Qty", "Unit", "Note", "Group", ""]],
    body: bodyRows(rows),
    styles: {
      font: FONT,
      fontSize: 9,
      cellPadding: { top: 1.4, bottom: 1.4, left: 1.8, right: 1.8 },
      lineColor: LINE,
      lineWidth: 0.1,
      textColor: INK,
      overflow: "linebreak",
    },
    headStyles: {
      font: FONT,
      fontStyle: "bold",
      fontSize: 8,
      textColor: MUTED,
      fillColor: [248, 250, 252],
      lineColor: FAINT,
    },
    // Item gets the widest fixed column and full-size ink; Group is deliberately
    // small and grey so it reads as a reference, not a heading. Note stays on
    // "auto" so it absorbs whatever width is left.
    columnStyles: {
      0: { cellWidth: 9, halign: "right", textColor: FAINT },
      1: { cellWidth: 56 },
      2: { cellWidth: 13, halign: "right" },
      3: { cellWidth: 15 },
      4: { cellWidth: "auto" },
      5: { cellWidth: 30, fontSize: 7.5, textColor: FAINT },
      6: { cellWidth: 9 },
    },
    didParseCell: (data) => {
      // Shrink the Group header too, so the column reads as secondary in the
      // header row as well as the body.
      if (data.column.index === 5) data.cell.styles.fontSize = 7.5;
      if (data.column.index === TICK_COL) data.cell.styles.halign = "center";
    },
    // Empty tick box for checking items off on delivery.
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== TICK_COL) return;
      const s = 3.4;
      const x = data.cell.x + (data.cell.width - s) / 2;
      const cy = data.cell.y + (data.cell.height - s) / 2;
      doc.setDrawColor(203, 213, 225).setLineWidth(0.2);
      doc.rect(x, cy, s, s);
    },
  };
}

// Build the order-sheet document. Exported so it can be unit-tested, or embedded
// / inspected by a caller instead of downloaded.
export function buildOrderPdf(order, items, lines, selected = null, excludedIds = null) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  registerUnicodeFont(doc);

  const pageH = doc.internal.pageSize.getHeight();
  const sheet = buildOrderSheet(order, items, lines, selected, excludedIds);
  const groups = sheet.sections;
  let y = drawLetterhead(doc, order);

  if (groups.length === 0) {
    doc.setFont(FONT, "normal").setFontSize(10).setTextColor(...MUTED);
    doc.text("Nothing selected for export.", MARGIN, y + 6);
    return doc;
  }

  for (const g of groups) {
    // Keep a heading with at least a couple of its rows: if there isn't room,
    // start the section on a fresh page rather than orphan the band.
    if (y + 22 > pageH - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
    y = drawSectionHeading(doc, g.orderType, g.count, y);
    autoTable(doc, tableOptions(doc, g.rows, y));
    y = doc.lastAutoTable.finalY + 6;
  }

  return doc;
}

// Build + download the order sheet as a .pdf file.
export async function downloadOrderPdf(order, items, lines, selected = null, excludedIds = null) {
  const doc = buildOrderPdf(order, items, lines, selected, excludedIds);
  doc.save(`${orderRef(order)}.pdf`);
}
