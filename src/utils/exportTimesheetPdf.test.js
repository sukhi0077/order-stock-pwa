// src/utils/exportTimesheetPdf.test.js
//
// The content model is asserted in detail; the rendered PDF only gets a smoke
// pass, because jsPDF writes subset glyph IDs that cannot be read back.
import { describe, it, expect } from "vitest";
import {
  monthLabel,
  buildEmployeeSheet,
  buildTeamSheet,
  buildEmployeePdf,
  buildTeamPdf,
  monthLabelPl,
  monthLabelBoth,
  formatDuration,
  datesInMonth,
  signaturePlacement,
  SIGNATURE_HEIGHT_MM,
} from "./exportTimesheetPdf.js";

const emp = { id: "e1", name: "Ravi Kumar" };
const entries = [
  { employeeId: "e1", workDate: "2026-08-03", startTime: "11:00", endTime: "15:00", breakMinutes: 0 },
  { employeeId: "e1", workDate: "2026-08-03", startTime: "18:00", endTime: "22:30", breakMinutes: 0 },
  { employeeId: "e1", workDate: "2026-08-04", startTime: "09:00", endTime: "17:00", breakMinutes: 30, note: "stock day" },
  { employeeId: "e1", workDate: "2026-07-31", startTime: "09:00", endTime: "17:00", breakMinutes: 0 },
];
const pageCount = (doc) => doc.internal.pages.length - 1;

describe("monthLabel", () => {
  it("reads as a month and year", () => {
    expect(monthLabel("2026-08")).toBe("August 2026");
    expect(monthLabel("2026-01")).toBe("January 2026");
  });
  it("does not invent a month from junk", () => {
    expect(monthLabel("nonsense")).toBe("nonsense");
    expect(monthLabel("")).toBe("");
  });

  it("gives the Polish month, lowercase as Polish writes it", () => {
    expect(monthLabelPl("2026-08")).toBe("sierpień 2026");
    expect(monthLabelPl("2026-10")).toBe("październik 2026");
  });

  it("prints Polish first and English second", () => {
    expect(monthLabelBoth("2026-08")).toBe("sierpień 2026 · August 2026");
  });

  it("does not repeat a month whose name is the same in both", () => {
    // Maj/May differ, but the guard matters for junk input, where both
    // functions fall back to the raw id and would otherwise print it twice.
    expect(monthLabelBoth("nonsense")).toBe("nonsense");
    expect(monthLabelBoth("2026-05")).toBe("maj 2026 · May 2026");
  });
});

describe("formatDuration", () => {
  it("writes minutes as min, not m", () => {
    expect(formatDuration(1952)).toBe("32h 32min");
    expect(formatDuration(450)).toBe("7h 30min");
    expect(formatDuration(45)).toBe("45min");
  });

  it("leaves off a zero remainder rather than printing 32h 0min", () => {
    expect(formatDuration(1920)).toBe("32h");
    expect(formatDuration(0)).toBe("0min");
  });

  it("does not go negative or NaN on junk", () => {
    expect(formatDuration(-60)).toBe("0min");
    expect(formatDuration(undefined)).toBe("0min");
  });
});

describe("buildEmployeeSheet", () => {
  const sheet = buildEmployeeSheet(emp, entries, "2026-08");

  it("carries the letterhead, name and month", () => {
    expect(sheet.business.nip).toBe("NIP 9241799529");
    expect(sheet.employeeName).toBe("Ravi Kumar");
    expect(sheet.monthLabel).toBe("August 2026");
    expect(sheet.monthLabelPl).toBe("sierpień 2026");
    expect(sheet.monthLabelBoth).toBe("sierpień 2026 · August 2026");
  });

  it("excludes other months", () => {
    expect(sheet.rows.some((r) => r.date === "2026-07-31")).toBe(false);
    expect(sheet.daysWorked).toBe(2);
  });

  it("prints every day of the month, worked or not", () => {
    // August has 31 days; two were worked, one of them twice.
    expect(sheet.rows).toHaveLength(32);
    expect(sheet.rows[0].date).toBe("2026-08-01");
    expect(sheet.rows.at(-1).date).toBe("2026-08-31");
  });

  it("dashes a day nobody worked, and leaves its note empty", () => {
    const off = sheet.rows.find((r) => r.date === "2026-08-01");
    expect(off).toMatchObject({ start: "--", end: "--", worked: "--", note: "", off: true });
  });

  it("counts only worked days in the total, not the dashed ones", () => {
    expect(sheet.daysWorked).toBe(2);
    expect(sheet.totalFormatted).toBe("16h");
  });

  it("gets the length of a short month and a leap February right", () => {
    expect(datesInMonth("2026-02")).toHaveLength(28);
    expect(datesInMonth("2024-02")).toHaveLength(29);
    expect(datesInMonth("2026-04")).toHaveLength(30);
    expect(datesInMonth("2026-12").at(-1)).toBe("2026-12-31");
  });

  it("falls back to listing what it has when the month id is junk", () => {
    // Better a short sheet than one with no dates on it at all.
    expect(datesInMonth("nonsense")).toEqual([]);
    expect(buildEmployeeSheet(emp, entries, "nonsense").rows).toEqual([]);
  });

  it("prints the date once per day, not per stretch of a split shift", () => {
    // Two rows for 3 Aug; repeating the date would read as two days.
    const third = sheet.rows.filter((r) => r.start === "11:00" || r.start === "18:00");
    expect(third).toHaveLength(2);
    expect(third[0].date).toBe("2026-08-03");
    expect(third[1].date).toBe("");
  });

  it("totals the month as hours and minutes only", () => {
    // 4h + 4h30 on the 3rd, 7h30 on the 4th = 16h.
    expect(sheet.totalFormatted).toBe("16h");
    expect(sheet.totalMinutes).toBe(960);
    // No decimal figure anywhere on an employee's own sheet — one number to
    // check, not two to reconcile.
    expect(sheet).not.toHaveProperty("totalDecimal");
  });

  it("writes each row's hours the same way as the total", () => {
    expect(sheet.rows.find((r) => r.start === "18:00").worked).toBe("4h 30min");
  });

  it("carries no break column", () => {
    // Breaks are not recorded any more. An old row's stored break is still
    // deducted from `worked`, but the sheet never prints it as its own figure.
    expect(sheet.rows.every((r) => !("breakMinutes" in r))).toBe(true);
    expect(sheet.rows.find((r) => r.start === "09:00").worked).toBe("7h 30min");
  });

  it("survives an unknown employee, and lays out a month nobody worked", () => {
    expect(buildEmployeeSheet(null, entries, "2026-08").employeeName).toBe("Unknown");
    const empty = buildEmployeeSheet(emp, entries, "2026-02");
    // Not blank: 28 dashed days, which is both a true record of the month and
    // a form somebody can fill in by hand.
    expect(empty.rows).toHaveLength(28);
    expect(empty.rows.every((r) => r.off)).toBe(true);
    expect(empty.daysWorked).toBe(0);
    expect(empty.totalFormatted).toBe("0min");
  });
});

describe("buildTeamSheet", () => {
  const employees = [emp, { id: "e2", name: "Anna Nowak" }];
  const all = [
    ...entries,
    { employeeId: "e2", workDate: "2026-08-03", startTime: "10:00", endTime: "20:15", breakMinutes: 0 },
  ];

  it("gives one row per employee, most hours first", () => {
    const sheet = buildTeamSheet(employees, all, "2026-08");
    expect(sheet.rows.map((r) => r.employeeName)).toEqual(["Ravi Kumar", "Anna Nowak"]);
    expect(sheet.rows[0].worked).toBe("16h");
  });

  it("carries minutes in the hours figure rather than a column of its own", () => {
    const sheet = buildTeamSheet(employees, all, "2026-08");
    expect(sheet.rows[1].worked).toBe("10h 15min");
    expect(sheet.rows.every((r) => !("decimal" in r))).toBe(true);
  });

  it("totals the team", () => {
    expect(buildTeamSheet(employees, all, "2026-08").totalFormatted).toBe("26h 15min");
  });
});

describe("signature block", () => {
  const A4 = 297; // mm

  it("stays on the page when there is room", () => {
    expect(signaturePlacement(200, A4)).toEqual({ newPage: false, y: 200 });
  });

  it("moves to a new page rather than being split or drawn off the edge", () => {
    // The last position that still fits, and the first that does not.
    const last = A4 - 14 - SIGNATURE_HEIGHT_MM;
    expect(signaturePlacement(last, A4).newPage).toBe(false);
    expect(signaturePlacement(last + 1, A4).newPage).toBe(true);
    expect(signaturePlacement(last + 1, A4).y).toBe(14);
  });
});

describe("rendering", () => {
  // A day worked every day of a 31-day month, plus `splits` second shifts.
  const monthOf = (splits) =>
    Array.from({ length: 31 }, (_, i) => {
      const date = `2026-08-${String(i + 1).padStart(2, "0")}`;
      const day = [{ employeeId: "e1", workDate: date, startTime: "11:00", endTime: "15:00" }];
      if (i < splits) day.push({ employeeId: "e1", workDate: date, startTime: "18:00", endTime: "22:45" });
      return day;
    }).flat();

  it("produces a one-page document for a normal month", () => {
    const doc = buildEmployeePdf(emp, entries, "2026-08");
    expect(pageCount(doc)).toBe(1);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(1000);
  });

  it("keeps a full 31-day month and the signature on one page", () => {
    // The whole point of printing every day is that the month is one sheet.
    // Row padding is set so this holds up to three split shifts as well.
    expect(pageCount(buildEmployeePdf(emp, monthOf(0), "2026-08"))).toBe(1);
    expect(pageCount(buildEmployeePdf(emp, monthOf(3), "2026-08"))).toBe(1);
  });

  it("renders Polish names without throwing", () => {
    const doc = buildEmployeePdf({ name: "Zofia Wiśniewska" }, entries, "2026-08");
    expect(pageCount(doc)).toBe(1);
  });

  it("still produces a document for an empty month", () => {
    // 31 dashed days, still one page.
    expect(pageCount(buildEmployeePdf(emp, [], "2026-08"))).toBe(1);
    expect(pageCount(buildTeamPdf([], [], "2026-08"))).toBe(1);
  });

  it("spills onto a second page when there is genuinely more to print", () => {
    // A month of split shifts is more content than a page holds; better a
    // second sheet than squeezed type.
    expect(pageCount(buildEmployeePdf(emp, monthOf(31), "2026-08"))).toBeGreaterThan(1);
  });

  it("does not mutate the entries it is given", () => {
    const snapshot = JSON.stringify(entries);
    buildEmployeePdf(emp, entries, "2026-08");
    expect(JSON.stringify(entries)).toBe(snapshot);
  });
});
