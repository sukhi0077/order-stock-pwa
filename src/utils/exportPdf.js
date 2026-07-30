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

// Turn the rows into an autoTable body with a full-width label row inserted
// whenever the category › sub-category group changes. The label row is what
// tells you which group the items beneath it belong to, so the group name is
// never repeated on every line.
//
// Item numbering restarts inside each group: on the shop floor you work one
// group at a time, so "Dairy #3" is easier to call out than a running total.
function withGroupRows(rows) {
  const body = [];
  let group = null;
  let n = 0;
  for (const r of rows) {
    if (r.group !== group) {
      group = r.group;
      n = 0;
      body.push([
        {
          content: group,
          colSpan: 6,
          styles: {
            fontStyle: "bold",
            fontSize: 8,
            // halign must be explicit: a spanning cell would otherwise pick up
            // the alignment of the last column it covers.
            halign: "left",
            textColor: TEAL,
            fillColor: [255, 255, 255],
            cellPadding: { top: 2.2, bottom: 1, left: 1.8, right: 1.8 },
          },
        },
      ]);
    }
    n += 1;
    body.push([
      String(n),
      r.item.name,
      String(orderNum(r.line.qty)),
      orderUnitOf(r.item),
      r.line.note || "",
      "",
    ]);
  }
  return body;
}

// A body row is a group label when it is the single spanning cell we inserted.
function isGroupRow(row) {
  return Array.isArray(row?.raw) && row.raw.length === 1;
}

// Shared autoTable config. Row padding is tight so the sheet stays compact.
function tableOptions(doc, rows, startY) {
  return {
    startY,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN },
    // Last column is the tick box; its header stays blank because Liberation
    // Sans has no U+2713 glyph and a missing glyph renders as a box in some
    // viewers. The empty column reads fine as a checklist gutter.
    head: [["#", "Item", "Qty", "Unit", "Note", ""]],
    body: withGroupRows(rows),
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
    // Item narrowed, Note left on "auto" so it takes all the slack — notes are
    // written on and read off the sheet, item names rarely need the room.
    columnStyles: {
      0: { cellWidth: 10, halign: "right", textColor: FAINT },
      1: { cellWidth: 58 },
      2: { cellWidth: 15, halign: "right", fontStyle: "bold" },
      3: { cellWidth: 18 },
      4: { cellWidth: "auto" },
      5: { cellWidth: 12 },
    },
    didParseCell: (data) => {
      // A group label spans the table: keep it left-aligned and unboxed rather
      // than letting it inherit the item-row borders and column alignment.
      if (data.section === "body" && isGroupRow(data.row)) {
        data.cell.styles.lineWidth = 0;
        data.cell.styles.halign = "left";
        return;
      }
      if (data.column.index === 5) data.cell.styles.halign = "center";
    },
    // Empty tick box for checking items off on delivery.
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 5) return;
      if (isGroupRow(data.row)) return;
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
  const groups = groupByOrderType(selectOrderRows(items, lines, selected, excludedIds));
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
    y = drawSectionHeading(doc, g.orderType, g.rows.length, y);
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
