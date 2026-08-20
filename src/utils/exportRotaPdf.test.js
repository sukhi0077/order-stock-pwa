// src/utils/exportRotaPdf.test.js
//
// Asserts on the sheet data, not the drawn PDF — jsPDF writes subset glyph ids,
// not readable text, so the built structure is what can be checked.
import { describe, it, expect } from "vitest";
import { buildRotaSheet, buildRotaPdf } from "./exportRotaPdf.js";

const PEOPLE = [
  { id: "a", name: "Ravi Kumar" },
  { id: "b", name: "Anna Nowak" },
];

const SHIFTS = [
  { employeeId: "a", onDate: "2026-08-10", startTime: "17:00", endTime: "23:00" },
  { employeeId: "b", onDate: "2026-08-10", startTime: "", endTime: "" },
  { employeeId: "a", onDate: "2026-08-12", startTime: "", endTime: "" },
  { employeeId: "z", onDate: "2026-08-10" }, // not on the roster — dropped
  { employeeId: "a", onDate: "2026-08-01" }, // before fromDate — dropped
];

describe("buildRotaSheet", () => {
  it("groups shifts by day, oldest first", () => {
    const sheet = buildRotaSheet(PEOPLE, SHIFTS, "2026-08-05");
    expect(sheet.rows.map((r) => r.date)).toEqual(["2026-08-10", "2026-08-12"]);
  });

  it("lists staff on a day, with times in brackets when set", () => {
    const sheet = buildRotaSheet(PEOPLE, SHIFTS, "2026-08-05");
    const tenth = sheet.rows.find((r) => r.date === "2026-08-10");
    // Sorted by name: Anna (no times) before Ravi (with times).
    expect(tenth.staff).toBe("Anna Nowak, Ravi Kumar (17:00 – 23:00)");
  });

  it("drops shifts for people not on the roster", () => {
    const sheet = buildRotaSheet(PEOPLE, SHIFTS, "2026-08-05");
    expect(JSON.stringify(sheet.rows)).not.toContain("z");
  });

  it("drops days before fromDate", () => {
    const sheet = buildRotaSheet(PEOPLE, SHIFTS, "2026-08-05");
    expect(sheet.rows.some((r) => r.date === "2026-08-01")).toBe(false);
  });

  it("is empty when nothing is scheduled", () => {
    expect(buildRotaSheet(PEOPLE, [], "2026-08-05").rows).toEqual([]);
  });
});

describe("buildRotaPdf", () => {
  it("builds a document without throwing, empty or not", () => {
    expect(() => buildRotaPdf(PEOPLE, SHIFTS, "2026-08-05", "Aug")).not.toThrow();
    expect(() => buildRotaPdf(PEOPLE, [], "2026-08-05", "Aug")).not.toThrow();
  });
});
