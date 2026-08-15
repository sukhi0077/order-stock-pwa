// src/components/AvailabilityAdmin.test.jsx
//
// A render test, not a model test — the maths is covered in TimesheetModel.
// What this catches is the class of bug the model tests cannot see: a hook
// wired wrongly, a field read off the wrong shape, a crash on an empty roster.
//
// It renders to a string rather than a browser, so it says nothing about how
// the grid LOOKS. Column widths and whether 31 columns are usable on a phone
// still need a real screen.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The service is the boundary: stub it and everything above it is real code.
vi.mock("../services/TimesheetService.js", () => ({
  TimesheetService: {
    getAvailabilityRange: vi.fn(),
  },
}));
vi.mock("../services/EmployeeService.js", () => ({
  EmployeeService: { list: vi.fn() },
}));

const { TimesheetService } = await import("../services/TimesheetService.js");
const { EmployeeService } = await import("../services/EmployeeService.js");
const { LanguageProvider } = await import("../i18n/i18n.jsx");
const AvailabilityAdmin = (await import("./AvailabilityAdmin.jsx")).default;

const PEOPLE = [
  { id: "a", name: "Ravi Kumar", active: true },
  { id: "b", name: "Anna Nowak", active: true },
];

// The screen opens on the week containing today, so the cache has to be seeded
// under exactly that key. Computed with the same helpers the component uses —
// hardcoding a week would make this test pass only until next Monday.
const { todayStr, shiftDateStr } = await import("../utils/monthUtils.js");
const { weekdayOf } = await import("../models/TimesheetModel.js");

function currentWeekKey() {
  const monday = shiftDateStr(todayStr(), -(weekdayOf(todayStr()) ?? 0));
  return ["availability", "range", monday, shiftDateStr(monday, 6)];
}

// Seeded rather than fetched: renderToString does a single pass, so a query
// left to resolve would only ever render the spinner.
function render({ people = PEOPLE, weekly = [], exceptions = [] } = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  EmployeeService.list.mockResolvedValue(people);
  TimesheetService.getAvailabilityRange.mockResolvedValue({ weekly, exceptions });
  qc.setQueryData(["employees", false], people);
  qc.setQueryData(currentWeekKey(), { weekly, exceptions });

  return renderToString(
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        <AvailabilityAdmin />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe("AvailabilityAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders without throwing and lists everyone", () => {
    const html = render();
    expect(html).toContain("Ravi Kumar");
    expect(html).toContain("Anna Nowak");
  });

  it("offers both the week and the month view", () => {
    const html = render();
    expect(html).toContain("Week");
    expect(html).toContain("Month");
  });

  it("labels every column with its weekday, not just its date", () => {
    // A bare row of numbers makes you count to find the Fridays.
    const html = render();
    for (const day of ["Mon", "Sat", "Sun"]) expect(html).toContain(day);
  });

  // The legend at the foot of the screen explains the marks, so it contains a
  // tick of its own. Counting rather than searching keeps that out of the way.
  const ticks = (html) => (html.match(/✓/g) || []).length;

  it("marks a day someone said yes to", () => {
    // The whole point of the screen. If the cells rendered but the data never
    // reached them, every assertion above would still pass.
    const html = render({
      exceptions: [{ employeeId: "a", onDate: todayStr(), available: true }],
    });
    expect(ticks(html)).toBe(2); // one in the grid, one in the legend
    expect(html).toContain("Free");
  });

  it("marks nobody free when nobody has answered", () => {
    // Silence is not a yes. Only the legend's tick should be on the page.
    expect(ticks(render())).toBe(1);
  });

  it("shows a day off distinctly from a day nobody answered for", () => {
    // Leave is an answer. If it rendered the same as silence, the one thing
    // this screen exists to surface would be invisible.
    const crosses = (html) => (html.match(/✕/g) || []).length;
    expect(crosses(render())).toBe(1); // legend only
    const html = render({
      exceptions: [{ employeeId: "a", onDate: todayStr(), available: false }],
    });
    expect(crosses(html)).toBe(2);
    expect(html).toContain("Off");
  });

  it("survives an empty roster instead of rendering a broken grid", () => {
    expect(() => render({ people: [] })).not.toThrow();
  });
});
