// src/utils/exportCsv.test.js
import { describe, it, expect } from "vitest";
import {
  UNASSIGNED,
  UNGROUPED,
  orderTypeOf,
  groupOf,
  orderTypesOnOrder,
  selectOrderRows,
  buildOrderCsv,
  buildMonthCsv,
  orderRef,
} from "./exportCsv.js";

const item = (id, over = {}) => ({
  id,
  name: id,
  unit: "kg",
  category: "Cat",
  subCategory: "Sub",
  orderType: "Makro",
  ...over,
});
const rows = (csv) => csv.split("\r\n");
const body = (csv) => rows(csv).slice(1);

describe("orderTypeOf / groupOf", () => {
  it("falls back to a label rather than an empty string", () => {
    expect(orderTypeOf({ orderType: "  " })).toBe(UNASSIGNED);
    expect(orderTypeOf({})).toBe(UNASSIGNED);
    expect(groupOf({})).toBe(UNGROUPED);
  });

  it("joins category and sub-category with a plain slash", () => {
    // Not "›": that glyph is outside the bundled PDF font subset and would
    // silently disappear from the printed sheet.
    expect(groupOf({ category: "Dairy", subCategory: "Fresh" })).toBe("Dairy / Fresh");
    expect(groupOf({ category: "Dairy" })).toBe("Dairy");
    expect(groupOf({ subCategory: "Fresh" })).toBe("Fresh");
  });
});

describe("orderTypesOnOrder", () => {
  it("lists only types that are actually on the order, sorted", () => {
    const items = [item("a", { orderType: "Vegetable" }), item("b"), item("c", { orderType: "Beer" })];
    const lines = { a: { qty: 1 }, c: { qty: 2 } }; // b not ordered
    expect(orderTypesOnOrder(items, lines)).toEqual(["Beer", "Vegetable"]);
  });
});

describe("selectOrderRows", () => {
  const items = [
    item("paneer", { name: "Paneer", category: "Dairy", subCategory: "Fresh" }),
    item("ghee", { name: "Ghee", category: "Dairy", subCategory: "Fats" }),
    item("onion", { name: "Onion", category: "Veg", subCategory: "Root", orderType: "Vegetable" }),
    item("spare", { name: "Spare" }),
  ];
  const lines = { paneer: { qty: 1 }, ghee: { qty: 2 }, onion: { qty: 3 } };

  it("drops items that are not on the order", () => {
    expect(selectOrderRows(items, lines).map((r) => r.item.id)).not.toContain("spare");
  });

  it("sorts by order type, then category, sub-category, name", () => {
    expect(selectOrderRows(items, lines).map((r) => r.item.name)).toEqual([
      "Ghee", // Makro / Dairy / Fats
      "Paneer", // Makro / Dairy / Fresh
      "Onion", // Vegetable
    ]);
  });

  it("filters by order type", () => {
    expect(selectOrderRows(items, lines, ["Vegetable"]).map((r) => r.item.id)).toEqual(["onion"]);
    expect(selectOrderRows(items, lines, [])).toEqual([]);
  });

  it("excludes individual items, from an array or a Set", () => {
    expect(selectOrderRows(items, lines, null, ["ghee"]).map((r) => r.item.id)).toEqual([
      "paneer",
      "onion",
    ]);
    expect(selectOrderRows(items, lines, null, new Set(["ghee", "onion"])).map((r) => r.item.id))
      .toEqual(["paneer"]);
  });

  it("combines both filters", () => {
    expect(selectOrderRows(items, lines, ["Makro"], ["ghee"]).map((r) => r.item.id)).toEqual([
      "paneer",
    ]);
  });

  it("never mutates the order it is given", () => {
    const snapshot = JSON.stringify({ items, lines });
    selectOrderRows(items, lines, ["Makro"], ["ghee"]);
    expect(JSON.stringify({ items, lines })).toBe(snapshot);
  });
});

describe("buildOrderCsv", () => {
  const items = [
    item("a", { name: "Paneer" }),
    item("b", { name: "Onion", orderType: "Vegetable", category: "Veg", subCategory: "Root" }),
  ];
  const lines = { a: { qty: 2 }, b: { qty: 5, note: 'ripe, "best"' } };

  it("has the agreed header and no order-ref/status columns", () => {
    expect(rows(buildOrderCsv({ id: "x" }, items, lines))[0]).toBe(
      "Order type,Group,Item,Quantity,Unit,Note",
    );
  });

  it("quotes notes containing commas and doubles embedded quotes", () => {
    const onion = body(buildOrderCsv({ id: "x" }, items, lines)).find((r) => r.includes("Onion"));
    expect(onion).toContain('"ripe, ""best"""');
  });

  it("emits a header-only file when everything is filtered out", () => {
    expect(body(buildOrderCsv({ id: "x" }, items, lines, []))).toEqual([]);
  });

  it("writes a sub-kilo line in grams, so the picker reads 100 g not 0.1 kg", () => {
    const kg = [item("k", { name: "Saffron", unit: "kg" })];
    const row = body(buildOrderCsv({ id: "x" }, kg, { k: { qty: 0.1 } }))[0];
    expect(row).toContain("Saffron,100,g");
  });

  it("leaves a whole kilo in kilos", () => {
    const kg = [item("k", { name: "Rice", unit: "kg" })];
    expect(body(buildOrderCsv({ id: "x" }, kg, { k: { qty: 5 } }))[0]).toContain("Rice,5,kg");
  });

  it("never converts a countable unit", () => {
    const b = [item("b", { name: "Beer", unit: "bottle" })];
    expect(body(buildOrderCsv({ id: "x" }, b, { b: { qty: 0.5 } }))[0]).toContain("Beer,0.5,bottle");
  });

  it("uses CRLF line endings, which Excel expects", () => {
    expect(buildOrderCsv({ id: "x" }, items, lines)).toContain("\r\n");
  });
});

describe("buildMonthCsv", () => {
  it("exports only counted items and stamps the month-end date", () => {
    const items = [item("a", { name: "Paneer" }), item("b", { name: "Ghee" })];
    const csv = buildMonthCsv("2026-02", items, { a: "4" });
    const lines = body(csv);
    expect(rows(csv)[0]).toBe("Item,Closing,Unit,Count Date,Month,Category,Sub-category");
    expect(lines).toHaveLength(1);
    // February 2026 has 28 days — the export must not assume 30.
    expect(lines[0]).toContain("2026-02-28");
  });
});

describe("orderRef", () => {
  it("builds a dated reference from the submit time and the id tail", () => {
    expect(orderRef({ id: "abcd1234", submittedAt: { seconds: 1785196800 } })).toMatch(
      /^ORD-\d{4}-\d{2}-\d{2}-1234$/,
    );
  });

  it("marks an unsubmitted order as a draft, and copes with no order at all", () => {
    expect(orderRef({ id: "abcd1234" })).toBe("ORD-draft-1234");
    expect(orderRef(null)).toBe("ORDER");
  });
});
