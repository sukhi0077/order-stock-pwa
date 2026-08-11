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
  // Typed in by hand: the tick is off and the box is the only source.
  const typed = (over = {}) => ({ ...base(), morningCashAuto: false, ...over });

  it("is null when left blank, not 0", () => {
    // A blank box and a genuine zero float are different facts; collapsing
    // them would make an unfilled field look like a counted empty till.
    expect(
      DailyReportModel.cleanPayloadForDatabase(typed({ morningCash: "" })).morningCash,
    ).toBeNull();
    expect(DailyReportModel.cleanPayloadForDatabase(typed()).morningCash).toBeNull();
    expect(
      DailyReportModel.cleanPayloadForDatabase(typed({ morningCash: "   " })).morningCash,
    ).toBeNull();
  });

  it("keeps a real zero", () => {
    expect(
      DailyReportModel.cleanPayloadForDatabase(typed({ morningCash: "0" })).morningCash,
    ).toBe(0);
  });

  it("rounds to 2 decimals, like every other money field", () => {
    expect(
      DailyReportModel.cleanPayloadForDatabase(typed({ morningCash: "120.456" })).morningCash,
    ).toBe(120.46);
  });

  it("starts blank on a fresh report", () => {
    expect(DailyReportModel.getInitialState().morningCash).toBe("");
  });

  describe("the 'same as yesterday' tick", () => {
    it("is on for a fresh report — the ordinary morning", () => {
      expect(DailyReportModel.getInitialState().morningCashAuto).toBe(true);
    });

    it("stores yesterday's closing cash while ticked, whatever is in the box", () => {
      const out = DailyReportModel.cleanPayloadForDatabase({
        ...base(),
        cashFromYesterday: "300",
        morningCash: "999",
        morningCashAuto: true,
      });
      expect(out.morningCash).toBe(300);
    });

    it("reads yesterday's cash at save time, so a late correction carries through", () => {
      // The concurrency check rewrites cashFromYesterday when someone else
      // submits first. A value copied at tick time would have gone stale here.
      const data = { ...base(), morningCash: "", morningCashAuto: true, cashFromYesterday: "180" };
      expect(DailyReportModel.cleanPayloadForDatabase(data).morningCash).toBe(180);
      expect(
        DailyReportModel.cleanPayloadForDatabase({ ...data, cashFromYesterday: "240" }).morningCash,
      ).toBe(240);
    });

    it("stores what was typed once unticked", () => {
      const out = DailyReportModel.cleanPayloadForDatabase({
        ...base(),
        cashFromYesterday: "300",
        morningCash: "275.5",
        morningCashAuto: false,
      });
      expect(out.morningCash).toBe(275.5);
    });

    it("only an explicit tick mirrors — anything else is treated as typed", () => {
      // A caller that knows nothing about the tick keeps the old behaviour.
      expect(
        DailyReportModel.resolveMorningCash({ cashFromYesterday: "300", morningCash: "120" }),
      ).toBe(120);
      expect(
        DailyReportModel.resolveMorningCash({
          cashFromYesterday: "300",
          morningCash: "120",
          morningCashAuto: "yes",
        }),
      ).toBe(120);
    });

    it("stays null when ticked but yesterday's cash is not known yet", () => {
      const out = DailyReportModel.cleanPayloadForDatabase({
        ...base(),
        cashFromYesterday: "",
        morningCash: "",
        morningCashAuto: true,
      });
      expect(out.morningCash).toBeNull();
    });

    it("opens a saved draft with the tick as it was left", () => {
      expect(DailyReportModel.normalize({ morningCashAuto: true }).morningCashAuto).toBe(true);
      expect(DailyReportModel.normalize({ morningCashAuto: false }).morningCashAuto).toBe(false);
    });

    it("opens a report from the database as a typed figure, not a re-derived one", () => {
      // The database records the amount, not how it was arrived at. Assuming
      // the tick would recompute a number somebody already checked.
      const loaded = DailyReportModel.normalize({ morningCash: 275.5, cashFromYesterday: 300 });
      expect(loaded.morningCashAuto).toBe(false);
      expect(DailyReportModel.cleanPayloadForDatabase(loaded).morningCash).toBe(275.5);
    });
  });

  describe("the gap against yesterday's closing cash", () => {
    const diff = (over) => DailyReportModel.morningCashDiff({ ...typed(), ...over });

    it("is negative when the box is short and positive when it is over", () => {
      expect(diff({ cashFromYesterday: "300", morningCash: "230" })).toBe(-70);
      expect(diff({ cashFromYesterday: "300", morningCash: "320" })).toBe(20);
    });

    it("is exactly zero when the count agrees", () => {
      // Zero, not null: the staff member did count, and it matched. That is a
      // different fact from not having looked.
      expect(diff({ cashFromYesterday: "300", morningCash: "300" })).toBe(0);
    });

    it("rounds away float drift instead of reporting a phantom gap", () => {
      // 300.1 - 300 is 0.09999999999997726 in binary floating point.
      expect(diff({ cashFromYesterday: "300", morningCash: "300.1" })).toBe(0.1);
      expect(diff({ cashFromYesterday: "0.3", morningCash: "0.1" })).toBe(-0.2);
    });

    it("has nothing to say while the tick is on", () => {
      // The two figures are the same by definition; a gap would be nonsense.
      expect(
        DailyReportModel.morningCashDiff({
          ...base(),
          morningCashAuto: true,
          cashFromYesterday: "300",
          morningCash: "230",
        }),
      ).toBeNull();
    });

    it("waits for both numbers before claiming a gap", () => {
      // Before either is known, a "0.00" would be an assertion, not a reading.
      expect(diff({ cashFromYesterday: "300", morningCash: "" })).toBeNull();
      expect(diff({ cashFromYesterday: "", morningCash: "230" })).toBeNull();
      expect(diff({ cashFromYesterday: "", morningCash: "" })).toBeNull();
    });
  });

  it("does NOT feed the expected-cash calculation", () => {
    // It is an observation that may disagree with yesterday's closing; the
    // cash chain is built on cashFromYesterday alone. If this ever changes it
    // should be a deliberate decision, not a silent one.
    const withCash = DailyReportModel.calculateExpectedCash(100, 50, [], []);
    expect(withCash).toBe(150);
  });
});
