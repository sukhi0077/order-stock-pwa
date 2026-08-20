// src/models/Frontdesk.test.js
import { describe, it, expect } from "vitest";
import { frontdeskAllOff, frontdeskAlertDates, groupAvailability } from "./TimesheetModel.js";

// byPerson shape the helpers expect: { [employeeId]: { weekly, exceptions } }.
function byPerson(exceptions) {
  return groupAvailability([], exceptions);
}

describe("frontdeskAllOff", () => {
  const D = "2026-08-14";

  it("is false when the front desk is empty (nothing to cover)", () => {
    expect(frontdeskAllOff(D, [], byPerson([]))).toBe(false);
  });

  it("is true only when every front desk member said off", () => {
    const bp = byPerson([
      { employeeId: "a", onDate: D, available: false },
      { employeeId: "b", onDate: D, available: false },
    ]);
    expect(frontdeskAllOff(D, ["a", "b"], bp)).toBe(true);
  });

  it("is false if any member is still available", () => {
    const bp = byPerson([
      { employeeId: "a", onDate: D, available: false },
      { employeeId: "b", onDate: D, available: true },
    ]);
    expect(frontdeskAllOff(D, ["a", "b"], bp)).toBe(false);
  });

  it("treats an unanswered member as not-off (silence is not a holiday)", () => {
    const bp = byPerson([{ employeeId: "a", onDate: D, available: false }]);
    // b never answered → we can't say the desk is uncovered.
    expect(frontdeskAllOff(D, ["a", "b"], bp)).toBe(false);
  });
});

describe("frontdeskAlertDates", () => {
  it("returns the set of uncovered dates", () => {
    const dates = ["2026-08-14", "2026-08-15"];
    const bp = byPerson([
      { employeeId: "a", onDate: "2026-08-14", available: false },
      { employeeId: "a", onDate: "2026-08-15", available: true },
    ]);
    const alerts = frontdeskAlertDates(dates, ["a"], bp);
    expect(alerts.has("2026-08-14")).toBe(true);
    expect(alerts.has("2026-08-15")).toBe(false);
  });
});
