// src/components/AvailabilityAdmin.jsx
//
// Everyone's availability on one screen, so a rota can be planned without
// asking five people the same question.
//
// Two views of the same data. The WEEK view is the one you roster from — seven
// wide columns, a name per row, readable on a phone. The MONTH view is for
// spotting shape: who has answered at all, which weeks are thin, when the
// holidays cluster. Neither is a substitute for the other, so both are here.
//
// The grid itself — the marks and the frozen name column — lives in
// AvailabilityGrid, shared with the staff "see everyone" view.
import React, { useMemo, useState } from "react";
import Spinner from "./ui/Spinner.jsx";
import AvailabilityGrid from "./timesheet/AvailabilityGrid.jsx";
import { useEmployees } from "../hooks/useEmployees.js";
import { useAvailabilityRange } from "../hooks/useTimesheet.js";
import {
  weekdayOf,
  groupAvailability,
  availabilityGrid,
  dayTallies,
} from "../models/TimesheetModel.js";
import {
  currentMonthId,
  prevMonthId,
  nextMonthId,
  datesInMonth,
  todayStr,
  shiftDateStr,
  formatDay,
} from "../utils/monthUtils.js";
import { useT } from "../i18n/i18n.jsx";

// The Monday on or before a date. Weeks are read Monday-first here, matching
// the availability pattern and how a rota is written.
function mondayOf(dateStr) {
  return shiftDateStr(dateStr, -(weekdayOf(dateStr) ?? 0));
}

export default function AvailabilityAdmin() {
  const { t, tMonth } = useT();
  const [view, setView] = useState("week"); // 'week' | 'month'
  const [monthId, setMonthId] = useState(currentMonthId());
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayStr()));

  const dates = useMemo(
    () =>
      view === "month"
        ? datesInMonth(monthId)
        : Array.from({ length: 7 }, (_, i) => shiftDateStr(weekStart, i)),
    [view, monthId, weekStart],
  );

  const { employees, isLoading: loadingEmployees } = useEmployees();
  // One query for the whole range rather than one per person: ten people would
  // otherwise be ten round trips before anything could be drawn.
  const availQuery = useAvailabilityRange(dates[0], dates[dates.length - 1]);

  // explicitOnly: only the dates a person actually tapped. Their "usual week"
  // is a habit, not a promise about a particular Tuesday — filling the grid
  // from it would show answers nobody gave, and a rota built on that puts
  // someone on a shift they never agreed to.
  const rows = useMemo(() => {
    const { weekly = [], exceptions = [] } = availQuery.data || {};
    return availabilityGrid(dates, employees, groupAvailability(weekly, exceptions), {
      explicitOnly: true,
    });
  }, [dates, employees, availQuery.data]);

  const tallies = useMemo(() => dayTallies(dates, rows), [dates, rows]);
  const today = todayStr();

  if (loadingEmployees) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const step = (dir) =>
    view === "month"
      ? setMonthId(dir < 0 ? prevMonthId(monthId) : nextMonthId(monthId))
      : setWeekStart(shiftDateStr(weekStart, dir * 7));

  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-n-100 rounded-xl p-1">
        {[
          ["week", t("ts_viewWeek")],
          ["month", t("ts_viewMonth")],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition ${
              view === id ? "bg-n-0 text-n-900 shadow-sm" : "text-n-500 hover:text-n-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-n-0 border border-n-200 rounded-2xl p-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => step(-1)}
            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-n-100 text-n-600 font-bold text-lg"
            aria-label="previous"
          >
            ‹
          </button>
          <div className="text-center font-bold text-n-900">
            {view === "month"
              ? tMonth(monthId)
              : `${formatDay(dates[0])} – ${formatDay(dates[6])}`}
          </div>
          <button
            onClick={() => step(1)}
            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-n-100 text-n-600 font-bold text-lg"
            aria-label="next"
          >
            ›
          </button>
        </div>
      </div>

      {availQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : employees.length === 0 ? (
        <p className="text-center text-n-400 py-8 text-sm">{t("ts_noStaff")}</p>
      ) : (
        <div className="bg-n-0 border border-n-200 rounded-2xl p-3">
          <AvailabilityGrid
            dates={dates}
            rows={rows}
            today={today}
            compact={view === "month"}
            tallies={tallies}
            freeLabel={t("ts_freeCount")}
            offLabel={t("ts_offCount")}
          />
        </div>
      )}

      <p className="text-[11px] text-n-400 px-1">{t("ts_availLegend")}</p>
    </div>
  );
}
