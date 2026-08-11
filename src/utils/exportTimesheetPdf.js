// src/utils/exportTimesheetPdf.js
//
// Monthly hours as a real .pdf, built the same way as the order sheet: jsPDF
// with the bundled Liberation Sans subset, so Polish names print correctly.
//
// Two shapes from one builder:
//   one employee  — every day listed, for the person being paid.
//   everyone      — one row per employee, for the owner running payroll.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { LIBERATION_SANS_REGULAR, LIBERATION_SANS_BOLD } from "../fonts/liberationSans.js";
import {
  monthlySummary,
  monthlyByEmployee,
  formatMinutes,
  toDecimalHours,
  entryMinutes,
} from "../models/TimesheetModel.js";

const BUSINESS = {
  name: "Misa Hindusa Poznan",
  address: "Szamarzewskiego 14, 60-516 Poznań",
  nip: "NIP 9241799529",
};

const FONT = "LiberationSans";
const ACCENT = [13, 148, 136];
const INK = [15, 23, 42];
const MUTED = [71, 85, 105];
const FAINT = [148, 163, 184];
const LINE = [226, 232, 240];
const MARGIN = 14;

function newDoc() {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("LiberationSans-Regular.ttf", LIBERATION_SANS_REGULAR);
  doc.addFont("LiberationSans-Regular.ttf", FONT, "normal");
  doc.addFileToVFS("LiberationSans-Bold.ttf", LIBERATION_SANS_BOLD);
  doc.addFont("LiberationSans-Bold.ttf", FONT, "bold");
  doc.setFont(FONT, "normal");
  return doc;
}

// "2026-08" -> "August 2026". Built from a fixed list rather than toLocale
// so the sheet reads the same whatever locale the phone is set to.
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export function monthLabel(monthId) {
  const [y, m] = String(monthId || "").split("-");
  const name = MONTHS[Number(m) - 1];
  return name ? `${name} ${y}` : String(monthId || "");
}

// Left: who is being paid, and for which month. Right: who is paying.
//
// The name leads the page at the same size as the business, because it is what
// someone thumbing through a stack of these sheets is looking for; the
// restaurant's details sit opposite, where a letterhead's small print belongs.
function drawLetterhead(doc, title, subtitle) {
  const right = doc.internal.pageSize.getWidth() - MARGIN;
  let y = MARGIN;

  doc.setFont(FONT, "bold").setFontSize(13).setTextColor(...INK);
  doc.text(title, MARGIN, y);
  doc.text(BUSINESS.name, right, y, { align: "right" });

  y += 4.5;
  doc.setFont(FONT, "normal").setFontSize(8.5).setTextColor(...MUTED);
  doc.text(subtitle, MARGIN, y);
  doc.text(BUSINESS.address, right, y, { align: "right" });

  y += 4;
  doc.text(BUSINESS.nip, right, y, { align: "right" });

  y += 3;
  doc.setDrawColor(...INK).setLineWidth(0.5);
  doc.line(MARGIN, y, right, y);
  return y + 6;
}

// Somewhere to sign, at the foot of an employee's own sheet.
//
// The sentence above the line is the point of it: a signature under nothing in
// particular settles nothing, whereas one under "these hours are correct" is
// the employee agreeing the month before it is paid. The date line sits beside
// it because a signature with no date cannot be tied to a payroll run.
// Height the block needs, declaration through to the labels under the lines.
export const SIGNATURE_HEIGHT_MM = 32;

// Where the block goes: on this page if it fits whole, otherwise a fresh one.
// Split across a page break, the declaration and the line it refers to end up
// on different sheets, and either half on its own means nothing.
export function signaturePlacement(y, pageHeight) {
  return y + SIGNATURE_HEIGHT_MM > pageHeight - MARGIN
    ? { newPage: true, y: MARGIN }
    : { newPage: false, y };
}

function drawSignature(doc, startY) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const right = pageWidth - MARGIN;

  const place = signaturePlacement(startY, pageHeight);
  if (place.newPage) doc.addPage();
  let y = place.y;

  y += 14;
  doc.setFont(FONT, "normal").setFontSize(8.5).setTextColor(...MUTED);
  doc.text("I confirm the hours recorded above are correct.", MARGIN, y);

  y += 14;
  const dateWidth = 46;
  const signEnd = right - dateWidth - 10;
  doc.setDrawColor(...FAINT).setLineWidth(0.3);
  doc.line(MARGIN, y, signEnd, y);
  doc.line(right - dateWidth, y, right, y);

  y += 4;
  doc.setFontSize(8).setTextColor(...FAINT);
  doc.text("Employee signature", MARGIN, y);
  doc.text("Date", right - dateWidth, y);
  return y;
}

const TABLE_STYLE = {
  font: FONT,
  fontSize: 9,
  cellPadding: { top: 1.6, bottom: 1.6, left: 1.8, right: 1.8 },
  lineColor: LINE,
  lineWidth: 0.1,
  textColor: INK,
  overflow: "linebreak",
};
const HEAD_STYLE = {
  font: FONT,
  fontStyle: "bold",
  fontSize: 8,
  textColor: MUTED,
  fillColor: [248, 250, 252],
  lineColor: FAINT,
};

// The content of a one-employee sheet, separate from its drawing so it can be
// asserted on — jsPDF writes subset glyph IDs, not readable text.
export function buildEmployeeSheet(employee, entries, monthId) {
  const summary = monthlySummary(entries, monthId);
  return {
    business: BUSINESS,
    employeeName: employee?.name || "Unknown",
    monthId,
    monthLabel: monthLabel(monthId),
    rows: summary.days.flatMap((day) =>
      day.entries.map((e, i) => ({
        // The date is printed once per day, not against every stretch of a
        // split shift — repeating it makes two rows look like two days.
        date: i === 0 ? day.date : "",
        start: e.startTime,
        end: e.endTime,
        worked: formatMinutes(entryMinutes(e)),
        note: e.note || "",
      })),
    ),
    daysWorked: summary.daysWorked,
    totalMinutes: summary.minutes,
    totalFormatted: summary.formatted,
    totalDecimal: toDecimalHours(summary.minutes),
  };
}

export function buildTeamSheet(employees, entries, monthId) {
  const rows = monthlyByEmployee(entries, monthId, employees);
  return {
    business: BUSINESS,
    monthId,
    monthLabel: monthLabel(monthId),
    rows: rows.map((r) => ({
      employeeName: r.employeeName,
      daysWorked: r.daysWorked,
      worked: r.formatted,
      decimal: r.hours,
    })),
    totalMinutes: rows.reduce((n, r) => n + r.minutes, 0),
    totalFormatted: formatMinutes(rows.reduce((n, r) => n + r.minutes, 0)),
  };
}

function drawTotal(doc, label, value, y) {
  const right = doc.internal.pageSize.getWidth() - MARGIN;
  doc.setFillColor(241, 245, 249);
  doc.rect(MARGIN, y, right - MARGIN, 8, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN, y, 1.2, 8, "F");
  doc.setFont(FONT, "bold").setFontSize(10).setTextColor(...INK);
  doc.text(label, MARGIN + 3.5, y + 5.5);
  doc.text(value, right - 3, y + 5.5, { align: "right" });
  return y + 8;
}

export function buildEmployeePdf(employee, entries, monthId) {
  const sheet = buildEmployeeSheet(employee, entries, monthId);
  const doc = newDoc();
  let y = drawLetterhead(doc, sheet.employeeName, sheet.monthLabel);

  if (sheet.rows.length === 0) {
    doc.setFont(FONT, "normal").setFontSize(10).setTextColor(...MUTED);
    doc.text("No hours recorded for this month.", MARGIN, y + 6);
    return doc;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN },
    head: [["Date", "Start", "End", "Worked", "Note"]],
    body: sheet.rows.map((r) => [r.date, r.start, r.end, r.worked, r.note]),
    styles: TABLE_STYLE,
    headStyles: HEAD_STYLE,
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 18, halign: "right" },
      2: { cellWidth: 18, halign: "right" },
      3: { cellWidth: 22, halign: "right", fontStyle: "bold" },
      4: { cellWidth: "auto" },
    },
  });

  y = doc.lastAutoTable.finalY + 5;
  y = drawTotal(doc, `${sheet.daysWorked} days worked`, sheet.totalFormatted, y);

  doc.setFont(FONT, "normal").setFontSize(8).setTextColor(...MUTED);
  y += 5;
  doc.text(`${sheet.totalDecimal} decimal hours`, MARGIN, y);

  drawSignature(doc, y);
  return doc;
}

export function buildTeamPdf(employees, entries, monthId) {
  const sheet = buildTeamSheet(employees, entries, monthId);
  const doc = newDoc();
  let y = drawLetterhead(doc, "Hours summary", sheet.monthLabel);

  if (sheet.rows.length === 0) {
    doc.setFont(FONT, "normal").setFontSize(10).setTextColor(...MUTED);
    doc.text("No hours recorded for this month.", MARGIN, y + 6);
    return doc;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN },
    head: [["Employee", "Days", "Hours", "Decimal"]],
    body: sheet.rows.map((r) => [r.employeeName, String(r.daysWorked), r.worked, String(r.decimal)]),
    styles: TABLE_STYLE,
    headStyles: HEAD_STYLE,
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 20, halign: "right" },
      2: { cellWidth: 28, halign: "right", fontStyle: "bold" },
      3: { cellWidth: 24, halign: "right", textColor: FAINT },
    },
  });

  y = doc.lastAutoTable.finalY + 5;
  drawTotal(doc, "Total", sheet.totalFormatted, y);
  return doc;
}

export async function downloadEmployeeTimesheetPdf(employee, entries, monthId) {
  const doc = buildEmployeePdf(employee, entries, monthId);
  const safe = String(employee?.name || "employee").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`hours-${safe}-${monthId}.pdf`);
}

export async function downloadTeamTimesheetPdf(employees, entries, monthId) {
  const doc = buildTeamPdf(employees, entries, monthId);
  doc.save(`hours-summary-${monthId}.pdf`);
}
