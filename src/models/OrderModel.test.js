// src/models/OrderModel.test.js
import { describe, it, expect } from "vitest";
import {
  num,
  isOrdered,
  toLines,
  cleanLines,
  validateLines,
  summarize,
  buildPayload,
  STATUS,
  MAX_QTY,
} from "./OrderModel.js";

describe("isOrdered()", () => {
  it("true only when qty > 0", () => {
    expect(isOrdered({ qty: 3 })).toBe(true);
    expect(isOrdered({ qty: "2.5" })).toBe(true);
    expect(isOrdered({ qty: 0 })).toBe(false);
    expect(isOrdered({ qty: "" })).toBe(false);
    expect(isOrdered({ note: "hi" })).toBe(false);
  });
});

describe("toLines()", () => {
  it("maps saved lines into editable working lines", () => {
    expect(toLines({ a: { qty: 3, note: "big bags" } })).toEqual({
      a: { qty: 3, note: "big bags" },
    });
  });
});

describe("cleanLines()", () => {
  it("keeps only ordered items, trims notes", () => {
    const cleaned = cleanLines({
      a: { qty: "3", note: "  urgent  " },
      b: { qty: 0, note: "ignored" },
      c: { qty: "", note: "" },
    });
    expect(cleaned).toEqual({ a: { qty: 3, note: "urgent" } });
  });
});

describe("validateLines()", () => {
  it("passes clean lines", () => {
    expect(validateLines({ a: { qty: 2, note: "x" } }).ok).toBe(true);
  });
  it("flags over-cap qty", () => {
    expect(validateLines({ a: { qty: MAX_QTY + 1 } }).ok).toBe(false);
  });
});

describe("summarize()", () => {
  const items = [
    { id: "a", category: "Kitchen", subCategory: "Dairy & Eggs" },
    { id: "b", category: "Kitchen", subCategory: "Dairy & Eggs" },
    { id: "c", category: "Bar", subCategory: "Beer" },
  ];
  it("counts items on order overall and per category/sub", () => {
    const s = summarize(items, { a: { qty: 2 }, c: { qty: 1 } });
    expect(s.onOrder).toBe(2);
    expect(s.totalItems).toBe(3);
    expect(s.byCategory.Kitchen).toEqual({ onOrder: 1, total: 2 });
    expect(s.byCategory.Bar).toEqual({ onOrder: 1, total: 1 });
    expect(s.bySub.Kitchen["Dairy & Eggs"]).toEqual({ onOrder: 1, total: 2 });
  });
});

describe("buildPayload()", () => {
  it("assembles a clean order payload", () => {
    const p = buildPayload({
      reporter: "Misa",
      status: STATUS.SUBMITTED,
      lines: { a: { qty: "4", note: "brand X" }, z: { qty: 0 } },
    });
    expect(p.reporter).toBe("Misa");
    expect(p.status).toBe("submitted");
    expect(p.lines).toEqual({ a: { qty: 4, note: "brand X" } });
  });
  it("defaults an unknown status to draft", () => {
    expect(buildPayload({ reporter: "x", status: "weird", lines: {} }).status).toBe("draft");
  });
});
