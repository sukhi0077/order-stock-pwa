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
  entryMinutes,
} from "../models/TimesheetModel.js";
import { monthEndDate } from "./monthUtils.js";

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

// The sheet is a Polish document: it is signed by people employed in Poland and
// may be read by an accountant or a labour inspector who works in Polish. The
// English underneath is for the kitchen, where not everyone reads Polish yet.
//
// Only the fixed furniture is translated. Names, dates and notes are printed as
// they were entered — a note typed in English is evidence of what was said, and
// machine-translating it would be inventing words nobody wrote.
const PL_MONTHS = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];
const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Kept English and single-language: the admin screen shows this above the month
// navigator, where the app already has its own language switch.
export function monthLabel(monthId) {
  const [y, m] = String(monthId || "").split("-");
  const name = EN_MONTHS[Number(m) - 1];
  return name ? `${name} ${y}` : String(monthId || "");
}

// "2026-08" -> "sierpień 2026 · August 2026", for the sheet itself. Built from
// fixed lists rather than toLocaleDateString so the printed page reads the same
// whatever language the phone happens to be set to.
export function monthLabelPl(monthId) {
  const [y, m] = String(monthId || "").split("-");
  const name = PL_MONTHS[Number(m) - 1];
  return name ? `${name} ${y}` : String(monthId || "");
}

// "32h 30min". The app writes "30m", which is fine in English, but on a Polish
// page a bare "m" is metres — "min" is the abbreviation a Pole expects, and it
// costs two characters. A whole number of hours prints without "0min".
export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}min`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}min`;
}

export function monthLabelBoth(monthId) {
  const pl = monthLabelPl(monthId);
  const en = monthLabel(monthId);
  return pl === en ? pl : `${pl} · ${en}`;
}

// Polish first, English second, everywhere. Short Polish is chosen where the
// column is narrow — "Od"/"Do" is how a Pole reads a time range — so every
// heading stays on one line rather than wrapping into two.
const T = {
  colDate: "Data / Date",
  colStart: "Od / Start",
  colEnd: "Do / End",
  colWorked: "Godziny / Worked",
  colNote: "Uwagi / Note",
  // "Person", not "employee": some of the people on this list are family or
  // casual help rather than anyone's employee, and a sheet that calls them
  // employees says something about their status that is not ours to say.
  colPerson: "Osoba / Person",
  colDays: "Dni / Days",
  colHours: "Godziny / Hours",
  summaryTitle: "Zestawienie godzin / Hours summary",
  total: "Razem · Total",
  // Days worked, phrased to sidestep Polish plurals: 1 dzień, 2 dni, 5 dni.
  daysWorked: (n) => `Przepracowane dni: ${n} · ${n} days worked`,
  empty: "Brak zarejestrowanych godzin w tym miesiącu.",
  emptyEn: "No hours recorded for this month.",
  declaration: "Potwierdzam, że powyższe godziny są prawidłowe.",
  declarationEn: "I confirm the hours recorded above are correct.",
  signature: "Podpis / Signature",
  signedDate: "Data / Date",
};

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
export const SIGNATURE_HEIGHT_MM = 36;

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

  y += 13;
  // The Polish sentence is the one being agreed to; the English under it is a
  // courtesy, set smaller and lighter so which is which is never in doubt.
  doc.setFont(FONT, "normal").setFontSize(8.5).setTextColor(...MUTED);
  doc.text(T.declaration, MARGIN, y);
  y += 4;
  doc.setFontSize(7.5).setTextColor(...FAINT);
  doc.text(T.declarationEn, MARGIN, y);

  y += 13;
  const dateWidth = 46;
  const signEnd = right - dateWidth - 10;
  doc.setDrawColor(...FAINT).setLineWidth(0.3);
  doc.line(MARGIN, y, signEnd, y);
  doc.line(right - dateWidth, y, right, y);

  y += 4;
  doc.setFontSize(8).setTextColor(...FAINT);
  doc.text(T.signature, MARGIN, y);
  doc.text(T.signedDate, right - dateWidth, y);
  return y;
}

const TABLE_STYLE = {
  font: FONT,
  fontSize: 9,
  // Tight enough that a 31-day month and the signature share one page. Any
  // tighter and the rows start to run together; the type size is left alone
  // because this is a page people read line by line before signing it.
  cellPadding: { top: 1.05, bottom: 1.05, left: 1.8, right: 1.8 },
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
// Every date in the month, "2026-08-01" through to the last day. Empty for an
// unparseable month id, which the caller treats as "list only what you have"
// rather than printing a sheet with no dates on it at all.
export function datesInMonth(monthId) {
  if (!/^\d{4}-\d{2}$/.test(String(monthId || ""))) return [];
  const last = Number(monthEndDate(monthId).slice(-2));
  if (!Number.isFinite(last) || last < 28 || last > 31) return [];
  return Array.from(
    { length: last },
    (_, i) => `${monthId}-${String(i + 1).padStart(2, "0")}`,
  );
}

// A day nobody worked. Two dashes rather than a blank cell: an empty row could
// be a day off or a day someone forgot to record, and on a sheet being signed
// the difference matters. A dash says the month was looked at.
export const BLANK = "--";

export function buildEmployeeSheet(employee, entries, monthId) {
  const summary = monthlySummary(entries, monthId);
  const worked = new Map(summary.days.map((d) => [d.date, d]));
  const calendar = datesInMonth(monthId);

  // The whole month, so the sheet is a record of all 30 or 31 days and not
  // just the ones with hours against them. A gap in a list of worked days is
  // invisible; a dashed line is a day you can point at and query.
  const rows = (calendar.length ? calendar : summary.days.map((d) => d.date)).flatMap(
    (date) => {
      const day = worked.get(date);
      if (!day) return [{ date, start: BLANK, end: BLANK, worked: BLANK, note: "", off: true }];
      return day.entries.map((e, i) => ({
        // The date is printed once per day, not against every stretch of a
        // split shift — repeating it makes two rows look like two days.
        date: i === 0 ? date : "",
        start: e.startTime,
        end: e.endTime,
        worked: formatDuration(entryMinutes(e)),
        note: e.note || "",
        off: false,
      }));
    },
  );

  return {
    business: BUSINESS,
    employeeName: employee?.name || "Unknown",
    monthId,
    monthLabel: monthLabel(monthId),
    monthLabelPl: monthLabelPl(monthId),
    monthLabelBoth: monthLabelBoth(monthId),
    rows,
    daysWorked: summary.daysWorked,
    totalMinutes: summary.minutes,
    // Hours and minutes, and nothing else. The employee signing this wants to
    // recognise their own shifts; a decimal alongside is a second number to
    // reconcile, and the one place a disagreement can start.
    totalFormatted: formatDuration(summary.minutes),
  };
}

export function buildTeamSheet(employees, entries, monthId) {
  const rows = monthlyByEmployee(entries, monthId, employees);
  return {
    business: BUSINESS,
    monthId,
    monthLabel: monthLabel(monthId),
    monthLabelPl: monthLabelPl(monthId),
    monthLabelBoth: monthLabelBoth(monthId),
    rows: rows.map((r) => ({
      employeeName: r.employeeName,
      daysWorked: r.daysWorked,
      // Same form as the employee's own sheet: the two documents describe the
      // same hours, and reading differently is how they come to be doubted.
      worked: formatDuration(r.minutes),
    })),
    totalMinutes: rows.reduce((n, r) => n + r.minutes, 0),
    totalFormatted: formatDuration(rows.reduce((n, r) => n + r.minutes, 0)),
  };
}

// The total sits directly after the days-worked line rather than out at the
// right margin. Across the width of a page the eye has to travel to pair them
// up, and the two numbers only mean anything together: 101h over 21 days is a
// different month from 101h over 8.
//
// The label carries the weight of ordinary text and the figure is bold, so the
// number reads first without the line shouting.
function drawTotal(doc, label, value, y) {
  const right = doc.internal.pageSize.getWidth() - MARGIN;
  doc.setFillColor(241, 245, 249);
  doc.rect(MARGIN, y, right - MARGIN, 8, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN, y, 1.2, 8, "F");

  const x = MARGIN + 3.5;
  const baseline = y + 5.5;
  doc.setFont(FONT, "normal").setFontSize(9.5).setTextColor(...MUTED);
  doc.text(label, x, baseline);
  // Measured while the label's own font is still active — getTextWidth reads
  // whatever is set now, so switching to bold first would return the wrong
  // number. The label's width changes with the day count, so a fixed offset
  // would collide on a long month.
  const labelWidth = doc.getTextWidth(label);

  doc.setFont(FONT, "bold").setFontSize(10).setTextColor(...INK);
  doc.text(value, x + labelWidth + 4, baseline);
  return y + 8;
}

export function buildEmployeePdf(employee, entries, monthId) {
  const sheet = buildEmployeeSheet(employee, entries, monthId);
  const doc = newDoc();
  let y = drawLetterhead(doc, sheet.employeeName, sheet.monthLabelBoth);

  // A month with no hours still prints its calendar — every day dashed, total
  // zero — which is a truthful record and doubles as a blank form. So this
  // only fires when the month id itself was unusable and there is genuinely
  // nothing to lay out.
  if (sheet.rows.length === 0) {
    doc.setFont(FONT, "normal").setFontSize(10).setTextColor(...MUTED);
    doc.text(T.empty, MARGIN, y + 6);
    doc.setFontSize(8.5).setTextColor(...FAINT);
    doc.text(T.emptyEn, MARGIN, y + 11);
    return doc;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN },
    head: [[T.colDate, T.colStart, T.colEnd, T.colWorked, T.colNote]],
    body: sheet.rows.map((r) => [r.date, r.start, r.end, r.worked, r.note]),
    styles: TABLE_STYLE,
    headStyles: HEAD_STYLE,
    // Widths measured against the bilingual headings so each stays on one
    // line; the note column takes what is left, still half the page.
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 18, halign: "right" },
      2: { cellWidth: 18, halign: "right" },
      3: { cellWidth: 28, halign: "right", fontStyle: "bold" },
      4: { cellWidth: "auto" },
    },
    // Days off recede so the worked days are what the eye lands on. They are
    // still there to be counted — just not competing for attention.
    didParseCell: (data) => {
      if (data.section === "body" && sheet.rows[data.row.index]?.off) {
        data.cell.styles.textColor = FAINT;
        data.cell.styles.fontStyle = "normal";
      }
    },
  });

  y = doc.lastAutoTable.finalY + 5;
  y = drawTotal(doc, T.daysWorked(sheet.daysWorked), sheet.totalFormatted, y);

  drawSignature(doc, y);
  return doc;
}

export function buildTeamPdf(employees, entries, monthId) {
  const sheet = buildTeamSheet(employees, entries, monthId);
  const doc = newDoc();
  let y = drawLetterhead(doc, T.summaryTitle, sheet.monthLabelBoth);

  if (sheet.rows.length === 0) {
    doc.setFont(FONT, "normal").setFontSize(10).setTextColor(...MUTED);
    doc.text(T.empty, MARGIN, y + 6);
    doc.setFontSize(8.5).setTextColor(...FAINT);
    doc.text(T.emptyEn, MARGIN, y + 11);
    return doc;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: MARGIN },
    head: [[T.colPerson, T.colDays, T.colHours]],
    body: sheet.rows.map((r) => [r.employeeName, String(r.daysWorked), r.worked]),
    styles: TABLE_STYLE,
    headStyles: HEAD_STYLE,
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 24, halign: "right" },
      2: { cellWidth: 32, halign: "right", fontStyle: "bold" },
    },
  });

  y = doc.lastAutoTable.finalY + 5;
  drawTotal(doc, T.total, sheet.totalFormatted, y);
  return doc;
}

export async function downloadEmployeeTimesheetPdf(employee, entries, monthId) {
  const doc = buildEmployeePdf(employee, entries, monthId);
  const safe = String(employee?.name || "person").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`hours-${safe}-${monthId}.pdf`);
}

export async function downloadTeamTimesheetPdf(employees, entries, monthId) {
  const doc = buildTeamPdf(employees, entries, monthId);
  doc.save(`hours-summary-${monthId}.pdf`);
}
