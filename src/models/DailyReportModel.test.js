// src/models/DailyReportModel.test.js
//
// Focused on the shape that goes to the database. The cash-adjustment order key
// is the reason this file exists: it is a sequence (1, 2, 3…), it was being
// written into a `timestamptz` column, and every save failed with
//   invalid input syntax for type timestamp with time zone: "1"
import { describe, it, expect } from "vitest";
import { DailyReportModel } from "./DailyReportModel.js";

const base = () => ({
  ...DailyReportModel.getInitialState(),
  totalSalePOS: "100",
  onlineSalePOS: "0",
  cardSalePOS: "60",
  cashSalePOS: "40",
});

// Everything the save payload carries for one cash adjustment.
const cashKeys = (entry) => Object.keys(entry).sort();

describe("cash adjustment order key", () => {
  it("is called seq, never ts — ts is a timestamp column in the database", () => {
    const out = DailyReportModel.cleanPayloadForDatabase({
      ...base(),
      cashTakenList: [{ amount: "10", reason: "coffee", seq: 1 }],
      cashAddedList: [{ amount: "5", reason: "float", seq: 2 }],
    });
    expect(cashKeys(out.cashTakenList[0])).toEqual(["amount", "reason", "seq"]);
    expect(cashKeys(out.cashAddedList[0])).toEqual(["amount", "reason", "seq"]);
    expect(out.cashTakenList[0]).not.toHaveProperty("ts");
    expect(out.cashAddedList[0]).not.toHaveProperty("ts");
  });

  it("carries the sequence through unchanged, as an integer", () => {
    const out = DailyReportModel.cleanPayloadForDatabase({
      ...base(),
      cashTakenList: [{ amount: "10", reason: "coffee", seq: 3 }],
    });
    expect(out.cashTakenList[0].seq).toBe(3);
    expect(Number.isInteger(out.cashTakenList[0].seq)).toBe(true);
  });

  it("omits seq entirely when there isn't one, rather than sending null", () => {
    const out = DailyReportModel.cleanPayloadForDatabase({
      ...base(),
      cashTakenList: [{ amount: "10", reason: "coffee" }],
    });
    expect(out.cashTakenList[0]).not.toHaveProperty("seq");
  });

  it("keeps seq 0 — it is a real value, not an absent one", () => {
    const out = DailyReportModel.cleanPayloadForDatabase({
      ...base(),
      cashTakenList: [{ amount: "10", reason: "coffee", seq: 0 }],
    });
    expect(out.cashTakenList[0].seq).toBe(0);
  });

  it("rounds the amount and trims the reason", () => {
    const out = DailyReportModel.cleanPayloadForDatabase({
      ...base(),
      cashTakenList: [{ amount: "10.005", reason: "  coffee  ", seq: 1 }],
    });
    expect(out.cashTakenList[0].amount).toBe(10.01);
    expect(out.cashTakenList[0].reason).toBe("coffee");
  });

  it("drops entries that are entirely blank", () => {
    const out = DailyReportModel.cleanPayloadForDatabase({
      ...base(),
      cashTakenList: [{ amount: "", reason: "" }, { amount: "5", reason: "float", seq: 1 }],
    });
    expect(out.cashTakenList).toHaveLength(1);
  });
});

describe("getInitialState", () => {
  it("starts both cash lists empty, so a fresh report sends no adjustments", () => {
    const d = DailyReportModel.getInitialState();
    expect(d.cashTakenList).toEqual([]);
    expect(d.cashAddedList).toEqual([]);
  });
});

describe("morningCash — what was counted in the box this morning", () => {
  it("is null when left blank, not 0", () => {
    // A blank box and a genuine zero float are different facts; collapsing
    // them would make an unfilled field look like a counted empty till.
    const out = DailyReportModel.cleanPayloadForDatabase({ ...base(), morningCash: "" });
    expect(out.morningCash).toBeNull();
    expect(DailyReportModel.cleanPayloadForDatabase({ ...base() }).morningCash).toBeNull();
    expect(
      DailyReportModel.cleanPayloadForDatabase({ ...base(), morningCash: "   " }).morningCash,
    ).toBeNull();
  });

  it("keeps a real zero", () => {
    expect(
      DailyReportModel.cleanPayloadForDatabase({ ...base(), morningCash: "0" }).morningCash,
    ).toBe(0);
  });

  it("rounds to 2 decimals, like every other money field", () => {
    expect(
      DailyReportModel.cleanPayloadForDatabase({ ...base(), morningCash: "120.456" }).morningCash,
    ).toBe(120.46);
  });

  it("starts blank on a fresh report", () => {
    expect(DailyReportModel.getInitialState().morningCash).toBe("");
  });

  it("does NOT feed the expected-cash calculation", () => {
    // It is an observation that may disagree with yesterday's closing; the
    // cash chain is built on cashFromYesterday alone. If this ever changes it
    // should be a deliberate decision, not a silent one.
    const withCash = DailyReportModel.calculateExpectedCash(100, 50, [], []);
    expect(withCash).toBe(150);
  });
});
