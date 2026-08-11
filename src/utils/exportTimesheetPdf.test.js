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
});

describe("buildEmployeeSheet", () => {
  const sheet = buildEmployeeSheet(emp, entries, "2026-08");

  it("carries the letterhead, name and month", () => {
    expect(sheet.business.nip).toBe("NIP 9241799529");
    expect(sheet.employeeName).toBe("Ravi Kumar");
    expect(sheet.monthLabel).toBe("August 2026");
  });

  it("excludes other months", () => {
    expect(sheet.rows.some((r) => r.date === "2026-07-31")).toBe(false);
    expect(sheet.daysWorked).toBe(2);
  });

  it("prints the date once per day, not per stretch of a split shift", () => {
    // Two rows for 3 Aug; repeating the date would read as two days.
    const third = sheet.rows.filter((r) => r.start === "11:00" || r.start === "18:00");
    expect(third).toHaveLength(2);
    expect(third[0].date).toBe("2026-08-03");
    expect(third[1].date).toBe("");
  });

  it("totals the month in both forms", () => {
    // 4h + 4h30 on the 3rd, 7h30 on the 4th = 16h.
    expect(sheet.totalFormatted).toBe("16h");
    expect(sheet.totalDecimal).toBe(16);
    expect(sheet.totalMinutes).toBe(960);
  });

  it("shows a break only when there is one", () => {
    const withBreak = sheet.rows.find((r) => r.start === "09:00");
    expect(withBreak.breakMinutes).toBe(30);
    expect(sheet.rows.find((r) => r.start === "11:00").breakMinutes).toBe(0);
  });

  it("survives an unknown employee and an empty month", () => {
    expect(buildEmployeeSheet(null, entries, "2026-08").employeeName).toBe("Unknown");
    const empty = buildEmployeeSheet(emp, entries, "2026-02");
    expect(empty.rows).toEqual([]);
    expect(empty.totalFormatted).toBe("0m");
  });
});

describe("buildTeamSheet", () => {
  const employees = [emp, { id: "e2", name: "Anna Nowak" }];
  const all = [
    ...entries,
    { employeeId: "e2", workDate: "2026-08-03", startTime: "10:00", endTime: "20:00", breakMinutes: 0 },
  ];

  it("gives one row per employee, most hours first", () => {
    const sheet = buildTeamSheet(employees, all, "2026-08");
    expect(sheet.rows.map((r) => r.employeeName)).toEqual(["Ravi Kumar", "Anna Nowak"]);
    expect(sheet.rows[0].worked).toBe("16h");
    expect(sheet.rows[1].worked).toBe("10h");
  });

  it("totals the team", () => {
    expect(buildTeamSheet(employees, all, "2026-08").totalFormatted).toBe("26h");
  });
});

describe("rendering", () => {
  it("produces a one-page document for a normal month", () => {
    const doc = buildEmployeePdf(emp, entries, "2026-08");
    expect(pageCount(doc)).toBe(1);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(1000);
  });

  it("renders Polish names without throwing", () => {
    const doc = buildEmployeePdf({ name: "Zofia Wiśniewska" }, entries, "2026-08");
    expect(pageCount(doc)).toBe(1);
  });

  it("still produces a document for an empty month", () => {
    expect(pageCount(buildEmployeePdf(emp, [], "2026-08"))).toBe(1);
    expect(pageCount(buildTeamPdf([], [], "2026-08"))).toBe(1);
  });

  it("paginates a full month of split shifts", () => {
    const many = Array.from({ length: 31 }, (_, i) => [
      { employeeId: "e1", workDate: `2026-08-${String(i + 1).padStart(2, "0")}`, startTime: "09:00", endTime: "13:00", breakMinutes: 0 },
      { employeeId: "e1", workDate: `2026-08-${String(i + 1).padStart(2, "0")}`, startTime: "17:00", endTime: "22:00", breakMinutes: 0 },
    ]).flat();
    expect(pageCount(buildEmployeePdf(emp, many, "2026-08"))).toBeGreaterThan(1);
  });

  it("does not mutate the entries it is given", () => {
    const snapshot = JSON.stringify(entries);
    buildEmployeePdf(emp, entries, "2026-08");
    expect(JSON.stringify(entries)).toBe(snapshot);
  });
});
