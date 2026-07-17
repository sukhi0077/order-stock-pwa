// src/models/StockCountModel.test.js
import { describe, it, expect } from "vitest";
import {
  num,
  isCounted,
  toCounts,
  cleanClosings,
  validateClosings,
  summarizeClosings,
  buildPayload,
  STATUS,
  MAX_QTY,
} from "./StockCountModel.js";

describe("num()", () => {
  it("coerces strings to numbers", () => {
    expect(num("12.5")).toBe(12.5);
  });
  it("clamps negatives and junk to 0", () => {
    expect(num(-4)).toBe(0);
    expect(num("abc")).toBe(0);
    expect(num(undefined)).toBe(0);
  });
  it("rounds to 3 decimals", () => {
    expect(num(1.23456)).toBe(1.235);
  });
});

describe("isCounted()", () => {
  it("blank / null / undefined are NOT counted", () => {
    expect(isCounted("")).toBe(false);
    expect(isCounted("   ")).toBe(false);
    expect(isCounted(null)).toBe(false);
    expect(isCounted(undefined)).toBe(false);
  });
  it("a typed 0 IS counted (out of stock)", () => {
    expect(isCounted(0)).toBe(true);
    expect(isCounted("0")).toBe(true);
  });
  it("any positive value is counted", () => {
    expect(isCounted(5)).toBe(true);
    expect(isCounted("2.5")).toBe(true);
  });
});

describe("toCounts()", () => {
  it("copies a persisted lines map into working counts", () => {
    expect(toCounts({ a: 3, b: 0 })).toEqual({ a: 3, b: 0 });
  });
  it("handles empty / missing", () => {
    expect(toCounts()).toEqual({});
  });
});

describe("cleanClosings()", () => {
  it("keeps counted items (including 0) and drops blanks", () => {
    const cleaned = cleanClosings({ a: "3.5", b: "", c: 0, d: "  ", e: "2" });
    expect(cleaned).toEqual({ a: 3.5, c: 0, e: 2 });
  });
  it("clamps negatives to 0", () => {
    expect(cleanClosings({ a: -5 })).toEqual({ a: 0 });
  });
});

describe("validateClosings()", () => {
  it("passes clean data", () => {
    expect(validateClosings({ a: 1, b: 0, c: "2.5" }).ok).toBe(true);
  });
  it("flags over-cap values", () => {
    const { ok, errors } = validateClosings({ a: MAX_QTY + 1 });
    expect(ok).toBe(false);
    expect(errors).toHaveLength(1);
  });
  it("ignores blank entries", () => {
    expect(validateClosings({ a: "", b: "  " }).ok).toBe(true);
  });
});

describe("summarizeClosings()", () => {
  const items = [
    { id: "a", category: "Kitchen" },
    { id: "b", category: "Kitchen" },
    { id: "c", category: "Bar" },
  ];
  it("counts entered items (0 counts) and computes remaining", () => {
    const s = summarizeClosings(items, { a: 10, b: 0 });
    expect(s.totalItems).toBe(3);
    expect(s.counted).toBe(2);
    expect(s.remaining).toBe(1);
  });
  it("groups counted/total by category", () => {
    const s = summarizeClosings(items, { a: 10 });
    expect(s.byCategory.Kitchen).toEqual({ counted: 1, total: 2 });
    expect(s.byCategory.Bar).toEqual({ counted: 0, total: 1 });
  });
  it("blank entries are not counted", () => {
    const s = summarizeClosings(items, { a: "", b: "  " });
    expect(s.counted).toBe(0);
  });
});

describe("buildPayload()", () => {
  it("assembles a clean, bounded payload of closing lines", () => {
    const payload = buildPayload({
      monthId: "2026-06",
      reporter: "Misa",
      status: STATUS.SUBMITTED,
      counts: { a: "12", b: "", c: 0 },
    });
    expect(payload.monthId).toBe("2026-06");
    expect(payload.reporter).toBe("Misa");
    expect(payload.status).toBe(STATUS.SUBMITTED);
    expect(payload.lines).toEqual({ a: 12, c: 0 });
  });
  it("falls back to draft for an unknown status", () => {
    const payload = buildPayload({ monthId: "2026-06", reporter: "x", status: "weird", counts: {} });
    expect(payload.status).toBe(STATUS.DRAFT);
  });
});
