// src/components/timesheet/AvailabilityGrid.jsx
//
// The people × dates availability grid, shared by the admin planner and the
// staff "see everyone" view. One place owns the two things that are easy to get
// wrong: the marks (a colour AND a glyph, so it survives black-and-white print
// and colour-blindness) and the frozen name column.
//
// THE FROZEN NAME COLUMN. The grid scrolls sideways — a month is 31 columns and
// will not fit a phone. If the names scrolled with it, the row you are reading
// drifts away from whose row it is. So the first column is `position: sticky`,
// pinned to the left edge of the scroll container, drawn on an opaque
// background over the cells sliding underneath it.
import React from "react";
import { WEEKDAYS, weekdayOf } from "../../models/TimesheetModel.js";

// One cell. A mark as well as a colour — see the note above.
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
              ? "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
              : "text-n-300"
      }`}
    >
      {yes ? "✓" : no ? "✕" : "·"}
    </span>
  );
}

// Shared classes for anything in the first (name) column: pinned left, opaque,
// above the scrolling cells, with a hairline on its right so the freeze is
// visible as the grid slides under it.
const STICKY =
  "sticky left-0 z-10 bg-n-0 pr-2 border-r border-n-100";

export default function AvailabilityGrid({
  dates = [],
  rows = [],
  today,
  compact = false,
  tallies = null,
  offLabel = "Off",
  highlightId = null,
  // Dates where the front desk is uncovered — every front desk member off.
  // Their column header is drawn in red so an uncovered day is scannable.
  alertDates = null,
}) {
  const isAlert = (date) => Boolean(alertDates && alertDates.has(date));
  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1 min-w-max"
        style={{
          gridTemplateColumns: `minmax(6.5rem, auto) repeat(${dates.length}, ${
            compact ? "1.35rem" : "2.4rem"
          })`,
        }}
      >
        {/* Top-left corner: sticky in both axes so it covers the name column's
            header slot while the date headers scroll under it. */}
        <span className={`${STICKY} z-20`} />
        {dates.map((date) => {
          const weekday = weekdayOf(date);
          // Two letters in the tight month view, full name in the roomy week
          // view — a lone "T" over the 6th and another over the 8th are
          // Tuesday and Thursday and you cannot tell which without counting.
          const short = compact ? WEEKDAYS[weekday].slice(0, 2) : WEEKDAYS[weekday];
          const weekend = weekday >= 5;
          const alert = isAlert(date);
          return (
            <span
              key={date}
              title={alert ? "no front desk cover" : undefined}
              className={`text-center text-[9px] font-bold leading-tight rounded ${
                alert
                  ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                  : date === today
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
            <span
              className={`${STICKY} text-xs font-semibold truncate self-center ${
                row.employeeId === highlightId
                  ? "text-accent-700 dark:text-accent-300"
                  : "text-n-800"
              }`}
            >
              {row.employeeName}
            </span>
            {row.cells.map((cell) => (
              <Mark key={cell.date} state={cell} dim={today ? cell.date < today : false} />
            ))}
          </React.Fragment>
        ))}

        {tallies && (
          <>
            {/* One count: who has told you they're off. Three people off the
                same Saturday is the thing to catch weeks out. (The "free" count
                was dropped — it read as a promise when most of a column was
                simply unanswered.) */}
            <span
              className={`${STICKY} text-[10px] font-bold uppercase tracking-wide text-n-500 self-center`}
            >
              {offLabel}
            </span>
            {tallies.map((d) => (
              <span
                key={d.date}
                className={`grid place-items-center h-7 text-[11px] font-bold ${
                  d.unavailable === 0 ? "text-n-300" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {d.unavailable}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
