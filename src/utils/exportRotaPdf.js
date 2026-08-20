// src/utils/exportRotaPdf.js
//
// The published rota as a real .pdf, so a staff member can print or save the
// schedule for the weeks ahead. Built the same way as the hours sheet — jsPDF
// with the bundled Liberation Sans subset, so Polish names print correctly.
//
// Shape: a day-by-day list. A rota is read "what's happening on Friday", not
// "when does Ravi work", so the day leads and the people on it follow. Only
// days with someone scheduled appear; an empty day is just a day off for the
// whole team and printing a blank line for it wastes the page.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { LIBERATION_SANS_REGULAR, LIBERATION_SANS_BOLD } from "../fonts/liberationSans.js";
import { formatDay } from "./monthUtils.js";
import { WEEKDAYS, weekdayOf } from "../models/TimesheetModel.js";
import { shiftTimeLabel } from "../models/RotaModel.js";

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

// Bilingual, Polish first, matching the hours sheet — the same wall it may be
// pinned next to.
const T = {
  title: "Grafik / Rota",
  colDay: "Dzień / Day",
  colStaff: "Obsada / On shift",
  empty: "Brak opublikowanego grafiku.",
  emptyEn: "No published rota yet.",
  none: "—",
};

// "Mon · 4 Aug 2026". The weekday leads because a rota is scanned by day name.
function dayLabel(dateStr) {
  const wd = weekdayOf(dateStr);
  const name = wd === null ? "" : WEEKDAYS[wd];
  return `${name} · ${formatDay(dateStr)}`;
}

// From flat shift rows + the roster, a day-by-day list. Separated from drawing
// so it can be asserted on — jsPDF writes subset glyph ids, not readable text.
export function buildRotaSheet(employees, shifts, fromDate) {
  const nameOf = new Map((employees || []).map((e) => [e.id, e.name]));
  // Only people still on the roster, only days from today on. A shift for
  // someone since removed, or for last Tuesday, is not part of the rota ahead.
  const byDate = new Map();
  for (const s of shifts || []) {
    if (!s || !s.onDate) continue;
    if (fromDate && s.onDate < fromDate) continue;
    if (!nameOf.has(s.employeeId)) continue;
    if (!byDate.has(s.onDate)) byDate.set(s.onDate, []);
    byDate.get(s.onDate).push({
      name: nameOf.get(s.employeeId),
      timeLabel: shiftTimeLabel(s),
    });
  }

  const rows = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, people]) => ({
      date,
      dayLabel: dayLabel(date),
      // Name, then times in brackets when they were set. Sorted so the same
      // person is always in the same reading position down the page.
      staff: people
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => (p.timeLabel ? `${p.name} (${p.timeLabel})` : p.name))
        .join(", "),
    }));

  return { business: BUSINESS, rows };
}

const TABLE_STYLE = {
  font: FONT,
  fontSize: 9,
  cellPadding: { top: 1.4, bottom: 1.4, left: 1.8, right: 1.8 },
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

export function buildRotaPdf(employees, shifts, fromDate, subtitle = "") {
  const sheet = buildRotaSheet(employees, shifts, fromDate);
  const doc = newDoc();
  let y = drawLetterhead(doc, T.title, subtitle);

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
    head: [[T.colDay, T.colStaff]],
    body: sheet.rows.map((r) => [r.dayLabel, r.staff || T.none]),
    styles: TABLE_STYLE,
    headStyles: HEAD_STYLE,
    alternateRowStyles: { fillColor: false },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: "bold", textColor: MUTED },
      1: { cellWidth: "auto" },
    },
    // A weekend day-name in the accent colour, so Saturdays and Sundays are
    // findable at a glance down the left edge.
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const wd = weekdayOf(sheet.rows[data.row.index]?.date);
        if (wd >= 5) data.cell.styles.textColor = ACCENT;
      }
    },
  });
  return doc;
}

export async function downloadRotaPdf(employees, shifts, fromDate, subtitle = "") {
  const doc = buildRotaPdf(employees, shifts, fromDate, subtitle);
  doc.save(`rota-${fromDate || "current"}.pdf`);
}
