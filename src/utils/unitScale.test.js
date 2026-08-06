// src/utils/unitScale.test.js
import { describe, it, expect } from "vitest";
import {
  canEnterSubUnit,
  smallUnitOf,
  isScalable,
  toSmall,
  fromSmall,
  displayQty,
  formatQty,
  SMALL_STEP,
} from "./unitScale.js";

describe("which units scale", () => {
  it("divides mass and volume", () => {
    expect(smallUnitOf("kg")).toBe("g");
    expect(smallUnitOf("ltr")).toBe("ml");
    expect(smallUnitOf("l")).toBe("ml");
  });

  it("leaves countable units alone — half a bottle is not an order", () => {
    for (const u of ["bottle", "pack", "pcs", "can", "jar", "roll", "bag", "month", "service"]) {
      expect(smallUnitOf(u), u).toBeNull();
      expect(isScalable(u), u).toBe(false);
    }
  });

  it("is case-insensitive and safe on junk", () => {
    expect(smallUnitOf("KG")).toBe("g");
    expect(smallUnitOf("")).toBeNull();
    expect(smallUnitOf(null)).toBeNull();
    expect(smallUnitOf(undefined)).toBeNull();
  });
});

describe("toSmall / fromSmall", () => {
  it("converts both ways", () => {
    expect(toSmall(0.1, "kg")).toBe(100);
    expect(toSmall(1.5, "kg")).toBe(1500);
    expect(fromSmall(100, "kg")).toBe(0.1);
    expect(fromSmall(1500, "kg")).toBe(1.5);
  });

  it("does not leak binary floating-point noise", () => {
    // 0.1 * 1000 is 100.00000000000001 without the rounding.
    expect(toSmall(0.1, "kg")).toBe(100);
    expect(toSmall(0.3, "kg")).toBe(300);
    expect(toSmall(0.7, "kg")).toBe(700);
  });

  it("round-trips the amounts a kitchen actually orders", () => {
    for (const g of [50, 100, 250, 300, 350, 500, 750, 1000, 1250]) {
      expect(toSmall(fromSmall(g, "kg"), "kg")).toBe(g);
    }
  });

  it("keeps converted values within the 3 decimals the column stores", () => {
    // 1 g is 0.001 kg — the smallest amount that survives a round trip.
    expect(fromSmall(1, "kg")).toBe(0.001);
    expect(toSmall(0.001, "kg")).toBe(1);
  });

  it("is a no-op for a unit that does not scale", () => {
    expect(toSmall(3, "bottle")).toBe(3);
    expect(fromSmall(3, "bottle")).toBe(3);
  });

  it("treats nothing as zero rather than NaN", () => {
    expect(toSmall(null, "kg")).toBe(0);
    expect(fromSmall(undefined, "kg")).toBe(0);
  });
});

describe("displayQty — how a quantity reads", () => {
  it("says sub-kilo amounts in grams", () => {
    expect(displayQty(0.1, "kg")).toEqual({ qty: 100, unit: "g" });
    expect(displayQty(0.35, "kg")).toEqual({ qty: 350, unit: "g" });
    expect(displayQty(0.999, "kg")).toEqual({ qty: 999, unit: "g" });
  });

  it("keeps a whole kilo and above in kilos — 1500 g is not how anyone says it", () => {
    expect(displayQty(1, "kg")).toEqual({ qty: 1, unit: "kg" });
    expect(displayQty(1.5, "kg")).toEqual({ qty: 1.5, unit: "kg" });
    expect(displayQty(12, "kg")).toEqual({ qty: 12, unit: "kg" });
  });

  it("does the same for litres", () => {
    expect(displayQty(0.25, "ltr")).toEqual({ qty: 250, unit: "ml" });
    expect(displayQty(2, "ltr")).toEqual({ qty: 2, unit: "ltr" });
  });

  it("never converts a countable unit", () => {
    expect(displayQty(0.5, "bottle")).toEqual({ qty: 0.5, unit: "bottle" });
    expect(displayQty(3, "pack")).toEqual({ qty: 3, unit: "pack" });
  });

  it("leaves zero alone rather than showing 0 g", () => {
    expect(displayQty(0, "kg")).toEqual({ qty: 0, unit: "kg" });
  });

  it("copes with a missing unit", () => {
    expect(displayQty(2, undefined)).toEqual({ qty: 2, unit: "" });
  });
});

describe("formatQty", () => {
  it("is the display pair as one string", () => {
    expect(formatQty(0.1, "kg")).toBe("100 g");
    expect(formatQty(2, "kg")).toBe("2 kg");
    expect(formatQty(3, "bottle")).toBe("3 bottle");
  });

  it("does not leave a trailing space when there is no unit", () => {
    expect(formatQty(2, "")).toBe("2");
  });
});

describe("SMALL_STEP", () => {
  it("steps in round hundreds, the way kitchens count", () => {
    expect(SMALL_STEP).toBe(100);
    // Three taps of + from empty is 300 g, i.e. 0.3 kg stored.
    expect(fromSmall(SMALL_STEP * 3, "kg")).toBe(0.3);
  });
});

describe("canEnterSubUnit — the per-item switch in Manage Items", () => {
  it("is OFF unless an admin switches it on", () => {
    // Opt-in: rice, onions and flour are the majority and go out in whole
    // kilos, so the toggle would be noise on nearly every row.
    expect(canEnterSubUnit({ unit: "kg" })).toBe(false);
    expect(canEnterSubUnit({ unit: "ltr" })).toBe(false);
    expect(canEnterSubUnit({ unit: "kg", allowSubUnit: false })).toBe(false);
  });

  it("is on once an admin switches it on", () => {
    expect(canEnterSubUnit({ unit: "kg", allowSubUnit: true })).toBe(true);
    expect(canEnterSubUnit({ unit: "ltr", allowSubUnit: true })).toBe(true);
  });

  it("stays off for a unit that cannot divide, however the switch is set", () => {
    expect(canEnterSubUnit({ unit: "bottle" })).toBe(false);
    expect(canEnterSubUnit({ unit: "bottle", allowSubUnit: true })).toBe(false);
  });

  it("follows the ORDER unit when one is set — a kg item ordered by the pack cannot split", () => {
    expect(canEnterSubUnit({ unit: "kg", orderUnit: "pack", allowSubUnit: true })).toBe(false);
    expect(canEnterSubUnit({ unit: "pack", orderUnit: "kg", allowSubUnit: true })).toBe(true);
  });

  it("is false for no item at all rather than throwing", () => {
    expect(canEnterSubUnit(null)).toBe(false);
    expect(canEnterSubUnit(undefined)).toBe(false);
    expect(canEnterSubUnit({})).toBe(false);
  });
});
