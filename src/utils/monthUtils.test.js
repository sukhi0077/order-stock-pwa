// src/utils/monthUtils.test.js
//
// Dates drive month rollover, expiry windows and the "count date" stamped on
// every export, so the edges that actually bite — year boundaries, February,
// 31st-of-the-month arithmetic, DST — are covered explicitly.
import { describe, it, expect } from "vitest";
import {
  currentMonthId,
  shiftMonthId,
  prevMonthId,
  nextMonthId,
  todayStr,
  shiftDateStr,
  diffDays,
  monthOf,
  monthEndDate,
  isCurrentMonth,
  recentMonthIds,
} from "./monthUtils.js";

describe("currentMonthId / todayStr", () => {
  it("formats as YYYY-MM and YYYY-MM-DD", () => {
    expect(currentMonthId()).toMatch(/^\d{4}-\d{2}$/);
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("agrees with each other — today is in the current month", () => {
    expect(todayStr().startsWith(currentMonthId())).toBe(true);
  });
});

describe("shiftMonthId", () => {
  it("moves within a year", () => {
    expect(shiftMonthId("2026-03", 1)).toBe("2026-04");
    expect(shiftMonthId("2026-03", -1)).toBe("2026-02");
  });

  it("crosses the year boundary in both directions", () => {
    expect(shiftMonthId("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthId("2026-01", -1)).toBe("2025-12");
  });

  it("handles multi-year jumps", () => {
    expect(shiftMonthId("2026-06", 12)).toBe("2027-06");
    expect(shiftMonthId("2026-06", -18)).toBe("2024-12");
  });

  it("is a no-op for zero", () => {
    expect(shiftMonthId("2026-06", 0)).toBe("2026-06");
  });
});

describe("prevMonthId / nextMonthId", () => {
  it("are shiftMonthId by one, and inverse of each other", () => {
    expect(prevMonthId("2026-01")).toBe("2025-12");
    expect(nextMonthId("2026-12")).toBe("2027-01");
    expect(nextMonthId(prevMonthId("2026-07"))).toBe("2026-07");
  });
});

describe("shiftDateStr", () => {
  it("adds and subtracts days", () => {
    expect(shiftDateStr("2026-07-10", 5)).toBe("2026-07-15");
    expect(shiftDateStr("2026-07-10", -5)).toBe("2026-07-05");
  });

  it("rolls over month and year ends", () => {
    expect(shiftDateStr("2026-07-31", 1)).toBe("2026-08-01");
    expect(shiftDateStr("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDateStr("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("gets February right in a common year and a leap year", () => {
    expect(shiftDateStr("2026-02-28", 1)).toBe("2026-03-01");
    expect(shiftDateStr("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftDateStr("2024-02-29", 1)).toBe("2024-03-01");
  });

  it("survives a DST transition — Poland springs forward on 29 Mar 2026", () => {
    // A naive +24h would land back on the same calendar day.
    expect(shiftDateStr("2026-03-28", 1)).toBe("2026-03-29");
    expect(shiftDateStr("2026-03-29", 1)).toBe("2026-03-30");
    // And back again in October.
    expect(shiftDateStr("2026-10-24", 1)).toBe("2026-10-25");
    expect(shiftDateStr("2026-10-25", 1)).toBe("2026-10-26");
  });
});

describe("diffDays", () => {
  it("counts whole days between two dates", () => {
    expect(diffDays("2026-07-10", "2026-07-15")).toBe(5);
    expect(diffDays("2026-07-15", "2026-07-10")).toBe(-5);
    expect(diffDays("2026-07-10", "2026-07-10")).toBe(0);
  });

  it("counts across a year boundary and across DST", () => {
    expect(diffDays("2025-12-31", "2026-01-01")).toBe(1);
    expect(diffDays("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("round-trips with shiftDateStr", () => {
    expect(diffDays("2026-05-01", shiftDateStr("2026-05-01", 45))).toBe(45);
  });
});

describe("monthOf", () => {
  it("takes the month from a date string", () => {
    expect(monthOf("2026-07-30")).toBe("2026-07");
  });
});

describe("monthEndDate", () => {
  it("returns the true last day, not a fixed 30", () => {
    expect(monthEndDate("2026-01")).toBe("2026-01-31");
    expect(monthEndDate("2026-04")).toBe("2026-04-30");
    expect(monthEndDate("2026-02")).toBe("2026-02-28");
    expect(monthEndDate("2024-02")).toBe("2024-02-29"); // leap year
    expect(monthEndDate("2026-12")).toBe("2026-12-31");
  });
});

describe("isCurrentMonth", () => {
  it("recognises this month and rejects a distant one", () => {
    expect(isCurrentMonth(currentMonthId())).toBe(true);
    expect(isCurrentMonth(shiftMonthId(currentMonthId(), 6))).toBe(false);
  });

  it("is strict — NO neighbouring-month cushion on the client", () => {
    // Worth pinning down, because the database disagrees on purpose:
    // public.is_current_month() in schema.sql allows a +/-31 day cushion so a
    // staff save near month-end is not rejected by RLS over a timezone
    // boundary. The client being the stricter of the two is the safe
    // direction; if this ever flips, the UI would offer an edit that the
    // database then refuses.
    expect(isCurrentMonth(shiftMonthId(currentMonthId(), 1))).toBe(false);
    expect(isCurrentMonth(shiftMonthId(currentMonthId(), -1))).toBe(false);
  });
});

describe("recentMonthIds", () => {
  it("returns n months, newest first, starting at the current month", () => {
    const ids = recentMonthIds(5);
    expect(ids).toHaveLength(5);
    expect(ids[0]).toBe(currentMonthId());
    for (let i = 1; i < ids.length; i++) expect(ids[i]).toBe(prevMonthId(ids[i - 1]));
  });

  it("has no duplicates across a year boundary", () => {
    const ids = recentMonthIds(18);
    expect(new Set(ids).size).toBe(18);
  });
});
