// src/utils/exportPdf.test.js
//
// Two layers:
//   buildOrderSheet — the content model, asserted in detail.
//   buildOrderPdf   — a smoke pass, because jsPDF writes text as subset glyph
//                     IDs and the finished file cannot be read back without the
//                     font's cmap. What it CAN prove is that a document is
//                     produced, has the expected page count, and never throws
//                     on the awkward inputs (Polish text, 120 items, nothing
//                     selected).
import { describe, it, expect } from "vitest";
import { buildOrderSheet, buildOrderPdf } from "./exportPdf.js";

const item = (id, over = {}) => ({
  id,
  name: id,
  unit: "kg",
  category: "Cat",
  subCategory: "Sub",
  orderType: "Makro",
  ...over,
});

const items = [
  item("a", { name: "Paneer", category: "Dairy", subCategory: "Fresh" }),
  item("b", { name: "Ghee", category: "Dairy", subCategory: "Fats" }),
  item("c", { name: "Onion", orderType: "Vegetable", category: "Veg", subCategory: "Root" }),
];
const lines = { a: { qty: 4 }, b: { qty: 2, note: "Amul only" }, c: { qty: 10 } };
const order = { id: "abcd1234", status: "submitted", submittedAt: { seconds: 1785196800 } };

const pageCount = (doc) => doc.internal.pages.length - 1; // index 0 is unused

describe("buildOrderSheet", () => {
  it("carries the letterhead, the order reference and the order's own date", () => {
    const s = buildOrderSheet(order, items, lines);
    expect(s.business.name).toBe("Misa Hindusa Poznan");
    expect(s.business.nip).toBe("NIP 9241799529");
    expect(s.ref).toMatch(/^ORD-\d{4}-\d{2}-\d{2}-1234$/);
    // The submitted date, not today.
    expect(s.date).toMatch(/2026/);
  });

  it("dates from createdAt when the order was never submitted", () => {
    const s = buildOrderSheet({ id: "x", createdAt: { seconds: 1785196800 } }, items, lines);
    expect(s.date).toMatch(/2026/);
  });

  it("makes one section per order type, alphabetically", () => {
    expect(buildOrderSheet(order, items, lines).sections.map((x) => x.orderType)).toEqual([
      "Makro",
      "Vegetable",
    ]);
  });

  it("counts each section", () => {
    const [makro, veg] = buildOrderSheet(order, items, lines).sections;
    expect(makro.count).toBe(2);
    expect(veg.count).toBe(1);
  });

  it("numbers rows continuously through a section, across group changes", () => {
    // Makro's two items are in different groups; the numbering must not reset.
    const makro = buildOrderSheet(order, items, lines).sections[0];
    expect(makro.rows.map((r) => r.n)).toEqual([1, 2]);
    expect(makro.rows.map((r) => r.group)).toEqual(["Dairy / Fats", "Dairy / Fresh"]);
    // The last number is also the section's item count.
    expect(makro.rows.at(-1).n).toBe(makro.count);
  });

  it("puts the group on the row rather than in a heading", () => {
    const row = buildOrderSheet(order, items, lines).sections[0].rows[0];
    expect(row).toMatchObject({
      name: "Ghee",
      qty: 2,
      unit: "kg",
      note: "Amul only",
      group: "Dairy / Fats",
    });
  });

  it("defaults a missing note to an empty string, never undefined", () => {
    expect(buildOrderSheet(order, items, lines).sections[1].rows[0].note).toBe("");
  });

  it("honours the order-type filter", () => {
    const s = buildOrderSheet(order, items, lines, ["Vegetable"]);
    expect(s.sections).toHaveLength(1);
    expect(s.sections[0].rows.map((r) => r.name)).toEqual(["Onion"]);
  });

  it("honours per-item exclusions and renumbers what is left", () => {
    const s = buildOrderSheet(order, items, lines, null, ["b"]);
    const makro = s.sections.find((x) => x.orderType === "Makro");
    expect(makro.rows.map((r) => [r.n, r.name])).toEqual([[1, "Paneer"]]);
    expect(makro.count).toBe(1);
  });

  it("yields no sections when nothing is selected", () => {
    expect(buildOrderSheet(order, items, lines, []).sections).toEqual([]);
    expect(buildOrderSheet(order, items, lines, null, ["a", "b", "c"]).sections).toEqual([]);
  });

  it("labels an item with no order type rather than dropping it", () => {
    const s = buildOrderSheet(order, [item("z", { orderType: "" })], { z: { qty: 1 } });
    expect(s.sections[0].orderType).toBe("Unassigned");
  });

  it("does not mutate the items or lines it is given", () => {
    const snapshot = JSON.stringify({ items, lines });
    buildOrderSheet(order, items, lines, ["Makro"], ["b"]);
    expect(JSON.stringify({ items, lines })).toBe(snapshot);
  });
});

describe("buildOrderPdf", () => {
  it("produces a single-page A4 document for a short order", () => {
    const doc = buildOrderPdf(order, items, lines);
    expect(pageCount(doc)).toBe(1);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(1000);
  });

  it("renders Polish characters without throwing — the bundled font subset exists for this", () => {
    const doc = buildOrderPdf(order, [item("z", { name: "Śmietana 30% — żurawina" })], {
      z: { qty: 1 },
    });
    expect(pageCount(doc)).toBe(1);
  });

  it("paginates a long order", () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      item(`i${i}`, { name: `Item ${i}`, orderType: ["Makro", "Vegetable", "Beer"][i % 3] }),
    );
    const manyLines = Object.fromEntries(many.map((it, i) => [it.id, { qty: i + 1 }]));
    expect(pageCount(buildOrderPdf(order, many, manyLines))).toBeGreaterThan(1);
  });

  it("still produces a document when nothing is selected", () => {
    expect(pageCount(buildOrderPdf(order, items, lines, []))).toBe(1);
  });

  it("survives an empty order and a missing order object", () => {
    expect(pageCount(buildOrderPdf(order, [], {}))).toBe(1);
    expect(pageCount(buildOrderPdf(null, items, lines))).toBe(1);
  });
});
