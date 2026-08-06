// src/models/ReceiptModel.test.js
import { describe, it, expect } from "vitest";
import {
  WINDOWS,
  MAX_QTY,
  num,
  isValidDate,
  daysLeft,
  inWindow,
  validate,
  buildPayload,
} from "./ReceiptModel.js";
import { todayStr, shiftDateStr, currentMonthId, shiftMonthId } from "../utils/monthUtils.js";

// A date inside a given month, safe from month-length edge cases.
const midOf = (monthId) => `${monthId}-15`;

describe("num", () => {
  it("parses numeric strings and clamps negatives to 0", () => {
    expect(num("2.5")).toBe(2.5);
    expect(num(3)).toBe(3);
    expect(num("-4")).toBe(0);
  });

  it("returns 0 for anything unparseable", () => {
    for (const v of ["", "abc", null, undefined, NaN, {}]) expect(num(v)).toBe(0);
  });

  it("rounds to 3 decimals, so float noise never reaches the database", () => {
    expect(num(0.1 + 0.2)).toBe(0.3);
    expect(num("1.23456")).toBe(1.235);
  });
});

describe("isValidDate", () => {
  it("accepts only YYYY-MM-DD strings", () => {
    expect(isValidDate("2026-07-30")).toBe(true);
    expect(isValidDate("2026-7-30")).toBe(false);
    expect(isValidDate("30-07-2026")).toBe(false);
    expect(isValidDate("")).toBe(false);
    expect(isValidDate(20260730)).toBe(false);
  });
});

describe("daysLeft", () => {
  it("counts forward, backward and same-day", () => {
    expect(daysLeft("2026-07-30", "2026-07-25")).toBe(5);
    expect(daysLeft("2026-07-20", "2026-07-25")).toBe(-5);
    expect(daysLeft("2026-07-25", "2026-07-25")).toBe(0);
  });

  it("returns null rather than a bogus number for an invalid date", () => {
    expect(daysLeft("not-a-date")).toBeNull();
  });

  it("crosses a month boundary correctly", () => {
    expect(daysLeft("2026-08-01", "2026-07-31")).toBe(1);
  });
});

describe("inWindow", () => {
  const today = todayStr();

  it("treats only dates strictly before today as expired", () => {
    expect(inWindow(shiftDateStr(today, -1), "expired", today)).toBe(true);
    expect(inWindow(today, "expired", today)).toBe(false);
  });

  it("bounds next30 inclusively at both ends", () => {
    expect(inWindow(today, "next30", today)).toBe(true);
    expect(inWindow(shiftDateStr(today, 30), "next30", today)).toBe(true);
    expect(inWindow(shiftDateStr(today, 31), "next30", today)).toBe(false);
    // Already expired is never "upcoming".
    expect(inWindow(shiftDateStr(today, -1), "next30", today)).toBe(false);
  });

  it("puts a date in next month into nextMonth but not thisMonth", () => {
    const next = midOf(shiftMonthId(currentMonthId(), 1));
    expect(inWindow(next, "nextMonth", today)).toBe(true);
    expect(inWindow(next, "thisMonth", today)).toBe(false);
  });

  it("spans three months for next2Months, upcoming only", () => {
    const cur = currentMonthId();
    expect(inWindow(midOf(shiftMonthId(cur, 2)), "next2Months", today)).toBe(true);
    expect(inWindow(midOf(shiftMonthId(cur, 3)), "next2Months", today)).toBe(false);
    expect(inWindow(shiftDateStr(today, -1), "next2Months", today)).toBe(false);
  });

  it("shows everything under `all`, expired included", () => {
    expect(inWindow(shiftDateStr(today, -400), "all", today)).toBe(true);
    expect(inWindow(today, "all", today)).toBe(true);
    expect(inWindow(shiftDateStr(today, 900), "all", today)).toBe(true);
  });

  it("takes `thisYear` as the whole CALENDAR year, past months included", () => {
    const year = today.slice(0, 4);
    expect(inWindow(`${year}-01-05`, "thisYear", today)).toBe(true);
    expect(inWindow(`${year}-12-31`, "thisYear", today)).toBe(true);
    // Not the next twelve months: December next year is a different year.
    expect(inWindow(`${Number(year) + 1}-01-05`, "thisYear", today)).toBe(false);
    expect(inWindow(`${Number(year) - 1}-12-31`, "thisYear", today)).toBe(false);
  });

  it("still rejects an invalid date under `all`, so junk never surfaces", () => {
    expect(inWindow("not-a-date", "all", today)).toBe(false);
    expect(inWindow("", "all", today)).toBe(false);
  });

  it("rejects an invalid date and an unknown window", () => {
    expect(inWindow("nope", "next30", today)).toBe(false);
    expect(inWindow(today, "someday", today)).toBe(false);
  });
});

describe("validate", () => {
  const good = { itemId: "i1", qty: "2", expiry: "2026-12-01" };

  it("accepts a complete receipt", () => {
    expect(validate(good)).toEqual({ ok: true, errors: [] });
  });

  it("rejects a missing item, a zero quantity and a bad date", () => {
    const r = validate({ itemId: "", qty: "0", expiry: "soon" });
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(3);
  });

  it("rejects a quantity above the cap but accepts the cap itself", () => {
    expect(validate({ ...good, qty: MAX_QTY }).ok).toBe(true);
    expect(validate({ ...good, qty: MAX_QTY + 1 }).ok).toBe(false);
  });
});

describe("buildPayload", () => {
  it("stores only the item FK — name and unit are joined back, not copied", () => {
    const p = buildPayload({
      item: { id: "i1", name: "Paneer", unit: "kg", category: "Dairy" },
      qty: "2.5",
      expiry: "2026-12-01",
      reporter: "a@b.com",
    });
    expect(p).toEqual({ itemId: "i1", qty: 2.5, expiry: "2026-12-01", reporter: "a@b.com" });
    expect(p).not.toHaveProperty("name");
    expect(p).not.toHaveProperty("unit");
  });

  it("truncates an over-long reporter and survives a missing one", () => {
    expect(buildPayload({ item: { id: "i" }, qty: 1, expiry: "2026-01-01", reporter: "x".repeat(200) }).reporter)
      .toHaveLength(120);
    expect(buildPayload({ item: { id: "i" }, qty: 1, expiry: "2026-01-01" }).reporter).toBe("");
  });
});

describe("WINDOWS", () => {
  it("lists the chips in the order they are shown, widest entry point first", () => {
    expect(WINDOWS).toEqual([
      "all",
      "expired",
      "thisMonth",
      "next30",
      "nextMonth",
      "next2Months",
      "thisYear",
    ]);
  });

  it("has a working implementation for every window it advertises", () => {
    // A window in the list with no case in inWindow would silently show
    // nothing at all.
    const someDate = todayStr();
    for (const w of WINDOWS) {
      expect(typeof inWindow(someDate, w, someDate), w).toBe("boolean");
    }
    // And every one of them is reachable: at least one date matches.
    for (const w of WINDOWS) {
      const candidates = [
        someDate,
        shiftDateStr(someDate, -1),
        shiftDateStr(someDate, 20),
        shiftDateStr(someDate, 40),
        shiftDateStr(someDate, 75),
      ];
      expect(candidates.some((d) => inWindow(d, w, someDate)), w).toBe(true);
    }
  });
});
