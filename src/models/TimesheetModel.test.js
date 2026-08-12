// src/models/TimesheetModel.test.js
//
// These numbers become wages, so the edges are covered explicitly: shifts that
// cross midnight, a day made of two rows, and rows saved back when breaks were
// still recorded.
import { describe, it, expect } from "vitest";
import {
  isValidTime,
  toMinutes,
  toTime,
  entryMinutes,
  crossesMidnight,
  formatMinutes,
  toDecimalHours,
  validateEntry,
  buildEntryPayload,
  byDay,
  totalMinutes,
  monthlySummary,
  monthlyByEmployee,
  weekdayOf,
  availabilityFor,
  groupAvailability,
  availabilityGrid,
  dayTallies,
  weeksOf,
  WEEKDAYS,
} from "./TimesheetModel.js";

const shift = (over = {}) => ({
  employeeId: "e1",
  workDate: "2026-08-10",
  startTime: "09:00",
  endTime: "17:00",
  breakMinutes: 0,
  ...over,
});

describe("time parsing", () => {
  it("accepts HH:MM and rejects everything else", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("9:00")).toBe(false);
    expect(isValidTime("09:60")).toBe(false);
    expect(isValidTime("")).toBe(false);
    expect(isValidTime(900)).toBe(false);
  });

  it("converts both ways", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("17:30")).toBe(1050);
    expect(toTime(1050)).toBe("17:30");
    expect(toTime(0)).toBe("00:00");
  });

  it("returns null for an unparseable time rather than treating it as midnight", () => {
    // 0 would be indistinguishable from a real 00:00 and would silently
    // produce a plausible-looking shift length.
    expect(toMinutes("nonsense")).toBeNull();
    expect(toMinutes(null)).toBeNull();
  });

  it("wraps rather than emitting 25:00", () => {
    expect(toTime(1440)).toBe("00:00");
    expect(toTime(1500)).toBe("01:00");
    expect(toTime(-60)).toBe("23:00");
  });
});

describe("entryMinutes", () => {
  it("measures an ordinary shift", () => {
    expect(entryMinutes(shift())).toBe(480);
  });

  it("still subtracts a break stored before the field was dropped", () => {
    // Breaks are no longer entered, but old rows carry one and were totalled
    // with it deducted. Ignoring it now would retrospectively add hours to
    // months that have already been paid.
    expect(entryMinutes(shift({ breakMinutes: 30 }))).toBe(450);
  });

  it("handles a shift crossing midnight — the case that would otherwise go negative", () => {
    expect(entryMinutes(shift({ startTime: "22:00", endTime: "02:00" }))).toBe(240);
    expect(crossesMidnight(shift({ startTime: "22:00", endTime: "02:00" }))).toBe(true);
    expect(crossesMidnight(shift())).toBe(false);
  });

  it("reads equal times as a full day, not zero", () => {
    // Nobody records a zero-length shift; 24h is wrong loudly enough to be
    // spotted and fixed, where 0 would just quietly lose someone's day.
    expect(entryMinutes(shift({ startTime: "09:00", endTime: "09:00" }))).toBe(1440);
  });

  it("never goes negative when an old break is longer than the shift", () => {
    expect(entryMinutes(shift({ startTime: "09:00", endTime: "10:00", breakMinutes: 120 }))).toBe(0);
  });

  it("is 0 when a time is missing or malformed", () => {
    expect(entryMinutes(shift({ endTime: "" }))).toBe(0);
    expect(entryMinutes(null)).toBe(0);
  });

  it("copes with a minute-level shift", () => {
    expect(entryMinutes(shift({ startTime: "09:00", endTime: "09:01" }))).toBe(1);
  });
});

describe("formatting", () => {
  it("reads as hours and minutes, not a decimal", () => {
    expect(formatMinutes(450)).toBe("7h 30m");
    expect(formatMinutes(480)).toBe("8h");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(0)).toBe("0m");
  });

  it("gives decimal hours for a wage calculation", () => {
    expect(toDecimalHours(450)).toBe(7.5);
    expect(toDecimalHours(485)).toBe(8.08);
    expect(toDecimalHours(0)).toBe(0);
  });
});

describe("validateEntry", () => {
  it("accepts a sound entry", () => {
    expect(validateEntry(shift())).toEqual({ ok: true, errors: [] });
  });

  it("accepts a night shift", () => {
    expect(validateEntry(shift({ startTime: "18:00", endTime: "01:30" })).ok).toBe(true);
  });

  it("rejects missing pieces", () => {
    const r = validateEntry({ workDate: "nope", startTime: "9", endTime: "" });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(4);
  });

  it("flags a shift over 16 hours as a likely typo", () => {
    // 09:00 to 08:00 next day is 23h — nearly always an am/pm slip.
    const r = validateEntry(shift({ startTime: "09:00", endTime: "08:00" }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/16 hours/);
  });
});

describe("buildEntryPayload", () => {
  it("normalises and trims", () => {
    const p = buildEntryPayload(shift({ note: "  covered for Ravi  " }));
    expect(p).toEqual({
      employeeId: "e1",
      workDate: "2026-08-10",
      startTime: "09:00",
      endTime: "17:00",
      note: "covered for Ravi",
    });
  });

  it("carries no break, even when one is handed to it", () => {
    // The column stays in the database for history; nothing new writes to it.
    expect(buildEntryPayload(shift({ breakMinutes: "30" }))).not.toHaveProperty("breakMinutes");
  });

  it("caps a runaway note", () => {
    expect(buildEntryPayload(shift({ note: "x".repeat(500) })).note).toHaveLength(200);
  });
});

describe("byDay and totals", () => {
  const entries = [
    shift({ workDate: "2026-08-10", startTime: "18:00", endTime: "22:00" }),
    shift({ workDate: "2026-08-10", startTime: "11:00", endTime: "15:00" }),
    shift({ workDate: "2026-08-11", startTime: "09:00", endTime: "17:00", breakMinutes: 30 }),
  ];

  it("groups a split shift into one day and sums it", () => {
    const days = byDay(entries);
    expect(days).toHaveLength(2);
    expect(days[0].date).toBe("2026-08-10");
    expect(days[0].entries).toHaveLength(2);
    expect(days[0].minutes).toBe(480);
  });

  it("orders days oldest first and stretches by start time", () => {
    const days = byDay(entries);
    expect(days.map((d) => d.date)).toEqual(["2026-08-10", "2026-08-11"]);
    expect(days[0].entries.map((e) => e.startTime)).toEqual(["11:00", "18:00"]);
  });

  it("totals everything", () => {
    expect(totalMinutes(entries)).toBe(480 + 450);
  });

  it("copes with nothing at all", () => {
    expect(byDay()).toEqual([]);
    expect(totalMinutes()).toBe(0);
  });
});

describe("monthlySummary", () => {
  const entries = [
    shift({ workDate: "2026-07-31" }),
    shift({ workDate: "2026-08-01" }),
    shift({ workDate: "2026-08-02", startTime: "10:00", endTime: "14:00" }),
  ];

  it("counts only the requested month", () => {
    const s = monthlySummary(entries, "2026-08");
    expect(s.daysWorked).toBe(2);
    expect(s.minutes).toBe(480 + 240);
    expect(s.hours).toBe(12);
    expect(s.formatted).toBe("12h");
  });

  it("returns an empty month rather than throwing", () => {
    const s = monthlySummary(entries, "2026-01");
    expect(s.daysWorked).toBe(0);
    expect(s.minutes).toBe(0);
    expect(s.formatted).toBe("0m");
  });
});

describe("monthlyByEmployee", () => {
  const employees = [
    { id: "e1", name: "Ravi" },
    { id: "e2", name: "Anna" },
  ];
  const entries = [
    shift({ employeeId: "e1", workDate: "2026-08-01" }),
    shift({ employeeId: "e2", workDate: "2026-08-01", startTime: "10:00", endTime: "20:00" }),
    shift({ employeeId: "e1", workDate: "2026-07-01" }),
  ];

  it("sorts by hours, most first", () => {
    const rows = monthlyByEmployee(entries, "2026-08", employees);
    expect(rows.map((r) => r.employeeName)).toEqual(["Anna", "Ravi"]);
    expect(rows[0].minutes).toBe(600);
  });

  it("names an employee that is no longer in the list rather than dropping them", () => {
    const rows = monthlyByEmployee(entries, "2026-08", []);
    expect(rows.every((r) => r.employeeName === "Unknown")).toBe(true);
    expect(rows).toHaveLength(2);
  });
});

describe("weekdayOf", () => {
  it("is Monday-first", () => {
    // 10 Aug 2026 is a Monday.
    expect(weekdayOf("2026-08-10")).toBe(0);
    expect(WEEKDAYS[weekdayOf("2026-08-10")]).toBe("Mon");
    expect(WEEKDAYS[weekdayOf("2026-08-16")]).toBe("Sun");
  });

  it("is null for junk", () => {
    expect(weekdayOf("not-a-date")).toBeNull();
  });
});

describe("availabilityFor", () => {
  const weekly = [
    { weekday: 0, available: true, fromTime: "17:00", toTime: "23:00" },
    { weekday: 6, available: false },
  ];

  it("uses the weekday pattern when there is no exception", () => {
    const a = availabilityFor("2026-08-10", { weekly });
    expect(a).toMatchObject({ source: "weekly", available: true, fromTime: "17:00" });
  });

  it("lets an exception override the pattern", () => {
    const exceptions = [{ onDate: "2026-08-10", available: false, note: "dentist" }];
    const a = availabilityFor("2026-08-10", { weekly, exceptions });
    expect(a).toMatchObject({ source: "exception", available: false, note: "dentist" });
  });

  it("says unknown rather than available when nothing is set", () => {
    // Silence is not a promise: rostering someone off an unanswered day is how
    // people end up expected on a shift they never agreed to.
    const a = availabilityFor("2026-08-12", { weekly });
    expect(a.source).toBe("none");
    expect(a.available).toBeNull();
  });

  it("honours an unavailable weekday", () => {
    expect(availabilityFor("2026-08-16", { weekly }).available).toBe(false);
  });

  it("survives being given nothing", () => {
    expect(availabilityFor("2026-08-10").source).toBe("none");
  });
});

// ---------------------------------------------------------------------------
// THE CONSOLIDATED VIEW
//
// August 2026: the 1st is a Saturday, so the grid has to pad five slots before
// it — a month that starts mid-week is where an off-by-one shifts every row.

describe("groupAvailability", () => {
  it("sorts flat rows into one bucket per person", () => {
    const out = groupAvailability(
      [{ employeeId: "a", weekday: 0, available: true }],
      [
        { employeeId: "a", onDate: "2026-08-04", available: false },
        { employeeId: "b", onDate: "2026-08-04", available: true },
      ],
    );
    expect(out.a.weekly).toHaveLength(1);
    expect(out.a.exceptions).toHaveLength(1);
    expect(out.b.weekly).toEqual([]);
    expect(out.b.exceptions).toHaveLength(1);
  });

  it("copes with nothing at all", () => {
    expect(groupAvailability()).toEqual({});
  });
});

describe("availabilityGrid", () => {
  const dates = ["2026-08-03", "2026-08-04"]; // Mon, Tue
  const people = [
    { id: "a", name: "Ravi" },
    { id: "b", name: "Anna" },
  ];
  const byPerson = groupAvailability(
    [{ employeeId: "a", weekday: 0, available: true }], // Ravi works Mondays
    [{ employeeId: "a", onDate: "2026-08-03", available: false }], // except this one
  );
  const rows = availabilityGrid(dates, people, byPerson);

  it("gives every person a row, including those who answered nothing", () => {
    // A name missing from the grid reads as "not working" when it means
    // "has not said" — and those are different problems for the rota.
    expect(rows.map((r) => r.employeeName)).toEqual(["Ravi", "Anna"]);
    expect(rows[1].cells.every((c) => c.available === null)).toBe(true);
  });

  it("lets a specific date override the usual week", () => {
    expect(rows[0].cells[0]).toMatchObject({ available: false, source: "exception" });
    expect(rows[0].cells[1]).toMatchObject({ available: null, source: "none" });
  });

  it("keeps cells in the order of the dates it was given", () => {
    expect(rows[0].cells.map((c) => c.date)).toEqual(dates);
  });
});

describe("dayTallies", () => {
  const dates = ["2026-08-03", "2026-08-04"];
  const rows = availabilityGrid(
    dates,
    [
      { id: "a", name: "Ravi" },
      { id: "b", name: "Anna" },
      { id: "c", name: "Zofia" },
    ],
    groupAvailability(
      [],
      [
        { employeeId: "a", onDate: "2026-08-03", available: true },
        { employeeId: "b", onDate: "2026-08-03", available: false },
        // Zofia has said nothing about either day.
      ],
    ),
  );

  it("counts the free, the unavailable and the silent separately", () => {
    // "1 available" means something different when one said no and one never
    // replied than when both said no.
    expect(dayTallies(dates, rows)[0]).toEqual({
      date: "2026-08-03",
      available: 1,
      unavailable: 1,
      unknown: 1,
      total: 3,
    });
  });

  it("never counts silence as available", () => {
    const day = dayTallies(dates, rows)[1];
    expect(day.available).toBe(0);
    expect(day.unknown).toBe(3);
  });
});

describe("weeksOf", () => {
  const august = Array.from(
    { length: 31 },
    (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`,
  );

  it("pads the first week so the 1st lands under its own weekday", () => {
    const weeks = weeksOf(august);
    // 1 Aug 2026 is a Saturday: index 5 in a Monday-first week.
    expect(weeks[0].slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(weeks[0][5]).toBe("2026-08-01");
  });

  it("gives every week exactly seven slots", () => {
    for (const week of weeksOf(august)) expect(week).toHaveLength(7);
  });

  it("keeps every date exactly once", () => {
    const flat = weeksOf(august).flat().filter(Boolean);
    expect(flat).toEqual(august);
  });

  it("pads the last week rather than leaving a short row", () => {
    const weeks = weeksOf(august);
    expect(weeks.at(-1).at(-1)).toBeNull();
    expect(weeks.at(-1).filter(Boolean).at(-1)).toBe("2026-08-31");
  });

  it("handles a month starting on a Monday without padding", () => {
    const june = Array.from(
      { length: 30 },
      (_, i) => `2026-06-${String(i + 1).padStart(2, "0")}`,
    );
    expect(weeksOf(june)[0][0]).toBe("2026-06-01");
  });

  it("returns nothing for no dates", () => {
    expect(weeksOf([])).toEqual([]);
  });
});
