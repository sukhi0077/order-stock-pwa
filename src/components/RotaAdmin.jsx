// src/components/RotaAdmin.jsx
//
// The owner's monthly rota. Availability is what staff SAY they can do; this is
// what the owner DECIDES they will do. The two never mix — see rota_schema.sql.
//
// How it is edited, and why this shape:
//   - A month grid, employees down the side, every day across the top, with the
//     name column frozen so a 31-column strip can scroll without losing whose
//     row it is.
//   - Tapping an empty cell schedules that person that day — the common case is
//     just "assign the day", so it is one tap and no dialog.
//   - Tapping a scheduled cell selects it; a panel below lets you add optional
//     start/end times or take the shift back off. Times are optional on purpose.
//   - A month is a DRAFT until Published. Staff see it only once published, so
//     the owner can move shifts around without anyone planning on a draft.
import React, { useMemo, useState } from "react";
import Spinner from "./ui/Spinner.jsx";
import { useEmployees } from "../hooks/useEmployees.js";
import { useRotaMonth, useRotaStatus, useSaveShift, useSetRotaStatus } from "../hooks/useRota.js";
import { useAvailabilityRange } from "../hooks/useTimesheet.js";
import { useFrontdesk } from "../hooks/useFrontdesk.js";
import { groupShifts, rotaGrid, rotaDayTallies, isPublished } from "../models/RotaModel.js";
import {
  WEEKDAYS,
  weekdayOf,
  isValidTime,
  groupAvailability,
  availabilityFor,
  frontdeskAlertDates,
} from "../models/TimesheetModel.js";
import {
  currentMonthId,
  prevMonthId,
  nextMonthId,
  datesInMonth,
  todayStr,
  formatDay,
} from "../utils/monthUtils.js";
import { useT } from "../i18n/i18n.jsx";

const STICKY = "sticky left-0 z-10 bg-n-0 pr-2 border-r border-n-100";

export default function RotaAdmin() {
  const { t, tMonth } = useT();
  const [monthId, setMonthId] = useState(currentMonthId());
  // { employeeId, employeeName, date } — the cell whose times are being edited.
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState({ startTime: "", endTime: "" });
  const [error, setError] = useState("");

  const { employees, isLoading: loadingEmployees } = useEmployees({ activeOnly: true });
  const shiftsQuery = useRotaMonth(monthId);
  const statusQuery = useRotaStatus(monthId);
  const saveShift = useSaveShift();
  const setStatus = useSetRotaStatus();

  const dates = useMemo(() => datesInMonth(monthId), [monthId]);
  const shifts = useMemo(() => shiftsQuery.data || [], [shiftsQuery.data]);
  const byPerson = useMemo(() => groupShifts(shifts), [shifts]);
  const rows = useMemo(
    () => rotaGrid(dates, employees, byPerson),
    [dates, employees, byPerson],
  );
  const tallies = useMemo(() => rotaDayTallies(dates, rows), [dates, rows]);
  const today = todayStr();
  const published = isPublished(statusQuery.data?.status);

  // Availability, so the owner sees who SAID they could work before deciding
  // who WILL. Only what people answered themselves (explicitOnly) — a usual
  // week is a habit, not a promise about a particular day, and colouring a cell
  // green off the back of it would invite a shift nobody agreed to.
  const availQuery = useAvailabilityRange(dates[0], dates[dates.length - 1]);
  const availByPerson = useMemo(() => {
    const { weekly = [], exceptions = [] } = availQuery.data || {};
    return groupAvailability(weekly, exceptions);
  }, [availQuery.data]);
  // true = said available, false = said off, null = never answered.
  const availOf = (employeeId, date) =>
    availabilityFor(date, availByPerson[employeeId] || {}, { explicitOnly: true }).available;

  // Days the front desk is uncovered — flagged red in the header so the owner
  // sees the gap before scheduling around it. Active members only.
  const { ids: frontdeskIds } = useFrontdesk();
  const alertDates = useMemo(() => {
    const active = employees
      .filter((e) => e.active !== false && frontdeskIds.has(e.id))
      .map((e) => e.id);
    return frontdeskAlertDates(dates, active, availByPerson);
  }, [dates, employees, frontdeskIds, availByPerson]);

  const openEditor = (employeeId, employeeName, date, shift) => {
    setSelected({ employeeId, employeeName, date });
    setDraft({ startTime: shift?.startTime || "", endTime: shift?.endTime || "" });
    setError("");
  };

  // Tap a cell: schedule an empty one straight away (and open it so times can be
  // added), or just open an already-scheduled one to edit or remove.
  const onCell = (row, cell) => {
    if (!cell.scheduled) {
      saveShift.mutate({ employeeId: row.employeeId, onDate: cell.date, value: {} });
    }
    openEditor(row.employeeId, row.employeeName, cell.date, cell);
  };

  const saveTimes = () => {
    setError("");
    const { startTime, endTime } = draft;
    // Both or neither. A start with no end (or the reverse) reads as a real
    // shift boundary to whoever sees it and is almost always a half-finished
    // edit; clearing both is how you say "scheduled, times not fixed".
    if ((startTime && !endTime) || (!startTime && endTime)) {
      setError(t("rota_bothTimes"));
      return;
    }
    if (startTime && (!isValidTime(startTime) || !isValidTime(endTime))) {
      setError(t("rota_badTime"));
      return;
    }
    saveShift.mutate(
      {
        employeeId: selected.employeeId,
        onDate: selected.date,
        value: { startTime: startTime || null, endTime: endTime || null },
      },
      { onSuccess: () => setSelected(null), onError: (e) => setError(e.message) },
    );
  };

  const removeShift = () => {
    saveShift.mutate(
      { employeeId: selected.employeeId, onDate: selected.date, value: null },
      { onSuccess: () => setSelected(null), onError: (e) => setError(e.message) },
    );
  };

  if (loadingEmployees) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Month navigator + publish state. A rota is about the future, so both
          arrows stay live — planning next month is the whole point. */}
      <div className="bg-n-0 border border-n-200 rounded-2xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMonthId(prevMonthId(monthId))}
            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-n-100 text-n-600 font-bold text-lg"
            aria-label="previous month"
          >
            ‹
          </button>
          <div className="text-center">
            <div className="font-bold text-n-900">{tMonth(monthId)}</div>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                published
                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                  : "bg-n-100 text-n-600"
              }`}
            >
              {published ? t("rota_published") : t("rota_draft")}
            </span>
          </div>
          <button
            onClick={() => setMonthId(nextMonthId(monthId))}
            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-n-100 text-n-600 font-bold text-lg"
            aria-label="next month"
          >
            ›
          </button>
        </div>

        <button
          type="button"
          disabled={setStatus.isPending || statusQuery.isLoading}
          onClick={() =>
            setStatus.mutate({ monthId, status: published ? "draft" : "published" })
          }
          className={`w-full py-2.5 rounded-xl font-semibold disabled:opacity-40 ${
            published
              ? "bg-n-0 border border-n-200 text-n-600"
              : "bg-accent-600 border border-accent-600 text-white"
          }`}
        >
          {setStatus.isPending
            ? t("saving")
            : published
              ? t("rota_unpublish")
              : t("rota_publish")}
        </button>
        <p className="text-[11px] text-n-400">
          {published ? t("rota_publishedHint") : t("rota_draftHint")}
        </p>
      </div>

      {employees.length === 0 ? (
        <p className="text-center text-n-400 py-8 text-sm">{t("ts_noStaff")}</p>
      ) : shiftsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="bg-n-0 border border-n-200 rounded-2xl p-3">
          <div className="overflow-x-auto">
            <div
              className="grid gap-1 min-w-max"
              style={{
                gridTemplateColumns: `minmax(6.5rem, auto) repeat(${dates.length}, 1.6rem)`,
              }}
            >
              <span className={`${STICKY} z-20`} />
              {dates.map((date) => {
                const wd = weekdayOf(date);
                const weekend = wd >= 5;
                const alert = alertDates.has(date);
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
                    {WEEKDAYS[wd].slice(0, 2)}
                    <br />
                    {Number(date.slice(-2))}
                  </span>
                );
              })}

              {rows.map((row) => (
                <React.Fragment key={row.employeeId}>
                  <span
                    className={`${STICKY} text-xs font-semibold text-n-800 truncate self-center`}
                  >
                    {row.employeeName}
                  </span>
                  {row.cells.map((cell) => {
                    const isSel =
                      selected?.employeeId === row.employeeId && selected?.date === cell.date;
                    const hasTimes = cell.scheduled && cell.startTime && cell.endTime;
                    const avail = availOf(row.employeeId, cell.date);
                    // Scheduling someone on a day they said they're OFF is the
                    // mistake this whole feature exists to prevent, so it gets
                    // an amber ring even over the selection ring.
                    const conflict = cell.scheduled && avail === false;
                    const tone = cell.scheduled
                      ? "bg-accent-600 text-white"
                      : avail === true
                        ? "bg-emerald-50 dark:bg-emerald-900/25 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                        : avail === false
                          ? "bg-rose-100 dark:bg-rose-900/30 text-rose-500 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/50"
                          : "bg-n-50 dark:bg-n-100 text-n-300 hover:bg-accent-50 dark:hover:bg-accent-900/20";
                    const ring = conflict
                      ? "ring-2 ring-amber-400"
                      : isSel
                        ? "ring-2 ring-accent-400"
                        : "";
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        onClick={() => onCell(row, cell)}
                        aria-label={`${row.employeeName} ${cell.date}`}
                        aria-pressed={cell.scheduled}
                        title={
                          avail === true
                            ? "available"
                            : avail === false
                              ? "said off"
                              : "not answered"
                        }
                        className={`h-7 rounded text-[10px] font-bold grid place-items-center transition ${tone} ${ring}`}
                      >
                        {cell.scheduled
                          ? hasTimes
                            ? "•"
                            : "✓"
                          : avail === true
                            ? "✓"
                            : avail === false
                              ? "✕"
                              : ""}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}

              <span
                className={`${STICKY} text-[10px] font-bold uppercase tracking-wide text-n-500 self-center`}
              >
                {t("rota_onCount")}
              </span>
              {tallies.map((d) => (
                <span
                  key={d.date}
                  className={`grid place-items-center h-7 text-[11px] font-bold ${
                    d.scheduled === 0 ? "text-n-300" : "text-n-700"
                  }`}
                >
                  {d.scheduled}
                </span>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-n-400 mt-2">{t("rota_gridHint")}</p>
          <p className="text-[11px] text-n-400 mt-1">{t("rota_availLegend")}</p>
          <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1">{t("fd_legend")}</p>
        </div>
      )}

      {/* The selected cell's editor: optional times, or take the shift off. */}
      {selected && (
        <div className="bg-n-0 border border-accent-200 dark:border-accent-800 rounded-2xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-bold text-n-900 truncate">{selected.employeeName}</div>
              <div className="text-[11px] text-n-500 flex items-center gap-1.5">
                <span>{formatDay(selected.date)}</span>
                {(() => {
                  const a = availOf(selected.employeeId, selected.date);
                  const badge =
                    a === true
                      ? "bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-300"
                      : a === false
                        ? "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
                        : "bg-n-100 text-n-500";
                  const label =
                    a === true
                      ? t("rota_availYes")
                      : a === false
                        ? t("rota_availNo")
                        : t("rota_availUnknown");
                  return (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${badge}`}>
                      {label}
                    </span>
                  );
                })()}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="h-8 w-8 grid place-items-center rounded-lg border border-n-200 text-n-500"
              aria-label="close"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-n-400">{t("ts_start")}</span>
              <input
                type="time"
                value={draft.startTime}
                onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))}
                className="h-11 px-2 rounded-lg bg-n-0 border border-n-300 text-n-900 outline-none focus:ring-2 focus:ring-accent-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-n-400">{t("ts_end")}</span>
              <input
                type="time"
                value={draft.endTime}
                onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))}
                className="h-11 px-2 rounded-lg bg-n-0 border border-n-300 text-n-900 outline-none focus:ring-2 focus:ring-accent-500"
              />
            </label>
          </div>
          <p className="text-[11px] text-n-400">{t("rota_timesHint")}</p>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveTimes}
              disabled={saveShift.isPending}
              className="flex-1 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-bold disabled:opacity-40"
            >
              {saveShift.isPending ? t("saving") : t("save")}
            </button>
            <button
              type="button"
              onClick={removeShift}
              disabled={saveShift.isPending}
              className="py-2.5 px-3 rounded-xl bg-n-0 border border-n-200 text-rose-600 dark:text-rose-400 font-semibold disabled:opacity-40"
            >
              {t("rota_removeShift")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
