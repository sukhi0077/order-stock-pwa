// src/components/AvailabilityAdmin.jsx
//
// Everyone's availability on one screen, so a rota can be planned without
// asking five people the same question.
//
// Two views of the same data. The WEEK view is the one you roster from — seven
// wide columns, a name per row, readable on a phone. The MONTH view is for
// spotting shape: who has answered at all, which weeks are thin, when the
// holidays cluster. Neither is a substitute for the other, so both are here.
import React, { useMemo, useState } from "react";
import Spinner from "./ui/Spinner.jsx";
import { useEmployees } from "../hooks/useEmployees.js";
import { useAvailabilityRange } from "../hooks/useTimesheet.js";
import {
  WEEKDAYS,
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

// One cell. A mark as well as a colour, so the grid survives being printed in
// black and white or read by someone colour-blind.
function Mark({ state, dim }) {
  const yes = state?.available === true;
  const no = state?.available === false;
  return (
    <span
      title={state?.source === "exception" ? "they answered for this date" : "not answered"}
      className={`grid place-items-center h-7 rounded text-[11px] font-bold ${
        dim
          ? "text-n-300"
          : yes
            ? "bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-300"
            : no
              ? // Red, and filled: someone on leave is the thing you are
                // scanning for. Grey made a booked holiday look like silence.
                "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
              : "text-n-300"
      }`}
    >
      {yes ? "✓" : no ? "✕" : "·"}
    </span>
  );
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
        <div className="bg-n-0 border border-n-200 rounded-2xl p-3 overflow-x-auto">
          {/* Fixed column widths rather than a table: the month view needs 31
              narrow columns and has to scroll sideways as one piece, names
              included, or the row you are reading drifts away from its name. */}
          <div
            className="grid gap-1 min-w-max"
            style={{
              gridTemplateColumns: `minmax(6.5rem, auto) repeat(${dates.length}, ${
                view === "month" ? "1.35rem" : "2.4rem"
              })`,
            }}
          >
            <span />
            {dates.map((date) => {
              const weekday = weekdayOf(date);
              // Two letters, not one. Down a 31-column strip a lone "T" over
              // the 6th and another over the 8th are Tuesday and Thursday and
              // you cannot tell which without counting — and the reason to
              // read this row at all is to find the Fridays.
              const short = view === "month"
                ? WEEKDAYS[weekday].slice(0, 2)
                : WEEKDAYS[weekday];
              const weekend = weekday >= 5;
              return (
                <span
                  key={date}
                  className={`text-center text-[9px] font-bold leading-tight ${
                    date === today
                      ? "text-accent-700 dark:text-accent-300"
                      : weekend
                        ? "text-n-500"
                        : "text-n-400"
                  }`}
                >
                  {short}
                  <br />
                  {Number(date.slice(-2))}
                </span>
              );
            })}

            {rows.map((row) => (
              <React.Fragment key={row.employeeId}>
                <span className="text-xs font-semibold text-n-800 truncate self-center pr-1">
                  {row.employeeName}
                </span>
                {row.cells.map((cell) => (
                  <Mark key={cell.date} state={cell} dim={cell.date < today} />
                ))}
              </React.Fragment>
            ))}

            {/* Two counts, because they answer different questions. "Free" is
                who you can call on. "Off" is who has told you they cannot —
                three people on leave the same Saturday is the thing you want
                to catch weeks out, and it is invisible in the free count when
                most of the team simply has not answered yet. */}
            <span className="text-[10px] font-bold uppercase tracking-wide text-n-500 self-center pr-1">
              {t("ts_freeCount")}
            </span>
            {tallies.map((d) => (
              <span
                key={d.date}
                className={`grid place-items-center h-7 text-[11px] font-bold ${
                  d.available === 0 ? "text-n-300" : "text-n-700"
                }`}
              >
                {d.available}
              </span>
            ))}

            <span className="text-[10px] font-bold uppercase tracking-wide text-n-500 self-center pr-1">
              {t("ts_offCount")}
            </span>
            {tallies.map((d) => (
              <span
                key={d.date}
                className={`grid place-items-center h-7 text-[11px] font-bold ${
                  d.unavailable === 0
                    ? "text-n-300"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {d.unavailable}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-n-400 px-1">{t("ts_availLegend")}</p>
    </div>
  );
}
