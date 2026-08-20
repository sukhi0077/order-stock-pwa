// src/models/RotaModel.test.js
import { describe, it, expect } from "vitest";
import {
  groupShifts,
  shiftFor,
  rotaGrid,
  rotaDayTallies,
  myShifts,
  shiftTimeLabel,
  isPublished,
} from "./RotaModel.js";

const SHIFTS = [
  { employeeId: "a", onDate: "2026-08-10", startTime: "17:00", endTime: "23:00" },
  { employeeId: "a", onDate: "2026-08-12" }, // scheduled, no times
  { employeeId: "b", onDate: "2026-08-10" },
];

describe("groupShifts / shiftFor", () => {
  it("indexes shifts by employee then date", () => {
    const byPerson = groupShifts(SHIFTS);
    expect(shiftFor("2026-08-10", byPerson.a).scheduled).toBe(true);
    expect(shiftFor("2026-08-10", byPerson.a).startTime).toBe("17:00");
    expect(shiftFor("2026-08-11", byPerson.a).scheduled).toBe(false);
  });

  it("treats a shift with no times as scheduled but timeless", () => {
    const byPerson = groupShifts(SHIFTS);
    const cell = shiftFor("2026-08-12", byPerson.a);
    expect(cell.scheduled).toBe(true);
    expect(cell.startTime).toBe(null);
    expect(cell.endTime).toBe(null);
  });

  it("ignores malformed rows rather than throwing", () => {
    expect(() => groupShifts([null, {}, { employeeId: "x" }])).not.toThrow();
  });
});

describe("rotaGrid", () => {
  const people = [
    { id: "a", name: "Ravi" },
    { id: "b", name: "Anna" },
    { id: "c", name: "Sam" },
  ];
  const dates = ["2026-08-10", "2026-08-11", "2026-08-12"];

  it("gives every person a row, including one with no shifts", () => {
    const rows = rotaGrid(dates, people, groupShifts(SHIFTS));
    expect(rows).toHaveLength(3);
    const sam = rows.find((r) => r.employeeId === "c");
    expect(sam.cells.every((c) => c.scheduled === false)).toBe(true);
  });

  it("marks the right cells scheduled", () => {
    const rows = rotaGrid(dates, people, groupShifts(SHIFTS));
    const ravi = rows.find((r) => r.employeeId === "a");
    expect(ravi.cells.map((c) => c.scheduled)).toEqual([true, false, true]);
  });
});

describe("rotaDayTallies", () => {
  it("counts how many people are on each date", () => {
    const people = [
      { id: "a", name: "Ravi" },
      { id: "b", name: "Anna" },
    ];
    const dates = ["2026-08-10", "2026-08-11"];
    const rows = rotaGrid(dates, people, groupShifts(SHIFTS));
    const tallies = rotaDayTallies(dates, rows);
    expect(tallies[0].scheduled).toBe(2); // a and b on the 10th
    expect(tallies[1].scheduled).toBe(0);
  });
});

describe("myShifts", () => {
  it("keeps only upcoming shifts, oldest first", () => {
    const rows = SHIFTS.filter((s) => s.employeeId === "a");
    const mine = myShifts(rows, "2026-08-11");
    expect(mine.map((s) => s.onDate)).toEqual(["2026-08-12"]);
  });

  it("returns everything when no fromDate given, sorted", () => {
    const rows = [
      { employeeId: "a", onDate: "2026-08-12" },
      { employeeId: "a", onDate: "2026-08-10" },
    ];
    expect(myShifts(rows).map((s) => s.onDate)).toEqual(["2026-08-10", "2026-08-12"]);
  });
});

describe("shiftTimeLabel", () => {
  it("shows a range only when both times are set", () => {
    expect(shiftTimeLabel({ startTime: "17:00", endTime: "23:00" })).toBe("17:00 – 23:00");
    expect(shiftTimeLabel({ startTime: null, endTime: null })).toBe("");
  });
});

describe("isPublished", () => {
  it("is true only for the published status", () => {
    expect(isPublished("published")).toBe(true);
    expect(isPublished("draft")).toBe(false);
    expect(isPublished(undefined)).toBe(false);
  });
});
