// src/components/RotaAdmin.test.jsx
//
// A render/wiring test, not a model test — the rota maths is covered in
// RotaModel.test. What this catches is a hook wired wrongly, a field read off
// the wrong shape, or a crash on an empty roster.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../services/RotaService.js", () => ({
  RotaService: {
    listMonth: vi.fn(),
    getMonthStatus: vi.fn(),
    setShift: vi.fn(),
    clearShift: vi.fn(),
    setMonthStatus: vi.fn(),
  },
}));
vi.mock("../services/TimesheetService.js", () => ({
  TimesheetService: { getAvailabilityRange: vi.fn() },
}));
vi.mock("../services/FrontdeskService.js", () => ({
  FrontdeskService: { list: vi.fn(), set: vi.fn() },
}));
vi.mock("../services/EmployeeService.js", () => ({
  EmployeeService: { list: vi.fn() },
}));

const { RotaService } = await import("../services/RotaService.js");
const { TimesheetService } = await import("../services/TimesheetService.js");
const { FrontdeskService } = await import("../services/FrontdeskService.js");
const { EmployeeService } = await import("../services/EmployeeService.js");
const { LanguageProvider } = await import("../i18n/i18n.jsx");
const RotaAdmin = (await import("./RotaAdmin.jsx")).default;

const { currentMonthId, monthEndDate } = await import("../utils/monthUtils.js");

const PEOPLE = [
  { id: "a", name: "Ravi Kumar", active: true },
  { id: "b", name: "Anna Nowak", active: true },
];

function render({ people = PEOPLE, shifts = [], status = "draft" } = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const month = currentMonthId();
  const first = `${month}-01`;
  const last = monthEndDate(month);
  EmployeeService.list.mockResolvedValue(people);
  RotaService.listMonth.mockResolvedValue(shifts);
  RotaService.getMonthStatus.mockResolvedValue({ monthId: month, status, publishedAt: null });
  TimesheetService.getAvailabilityRange.mockResolvedValue({ weekly: [], exceptions: [] });
  FrontdeskService.list.mockResolvedValue([]);
  qc.setQueryData(["employees", true], people);
  qc.setQueryData(["rota", month, "all"], shifts);
  qc.setQueryData(["rota-status", month], { monthId: month, status, publishedAt: null });
  qc.setQueryData(["availability", "range", first, last], { weekly: [], exceptions: [] });
  qc.setQueryData(["frontdesk"], []);

  return renderToString(
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        <RotaAdmin />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe("RotaAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the roster without throwing", () => {
    const html = render();
    expect(html).toContain("Ravi Kumar");
    expect(html).toContain("Anna Nowak");
  });

  it("shows a draft month as a draft, with a publish action", () => {
    const html = render({ status: "draft" });
    expect(html).toContain("Draft");
    expect(html).toContain("Publish rota");
  });

  it("shows a published month as published", () => {
    const html = render({ status: "published" });
    expect(html).toContain("Published");
    expect(html).toContain("Unpublish");
  });

  it("survives an empty roster instead of a broken grid", () => {
    expect(() => render({ people: [] })).not.toThrow();
  });
});
