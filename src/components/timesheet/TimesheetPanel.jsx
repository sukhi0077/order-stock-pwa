// src/components/timesheet/TimesheetPanel.jsx
//
// The staff-facing timesheet: pick who you are, prove it with a PIN, then log
// hours and set availability.
//
// The PIN is a deterrent, not a security boundary — every staff device signs
// in as the same database user, so RLS cannot tell two employees apart. It
// stops someone casually logging hours against a colleague's name; the admin's
// review is the actual control. See supabase/timesheet_schema.sql.
import React, { useMemo, useState } from "react";
import Spinner from "../ui/Spinner.jsx";
import { useEmployees } from "../../hooks/useEmployees.js";
import {
  useTimesheetMonth,
  useSaveEntry,
  useRemoveEntry,
  useAvailability,
  useSaveAvailability,
} from "../../hooks/useTimesheet.js";
import { TimesheetService } from "../../services/TimesheetService.js";
import { currentMonthId, todayStr, shiftDateStr, formatDay } from "../../utils/monthUtils.js";
import {
  WEEKDAYS,
  byDay,
  entryMinutes,
  formatMinutes,
  monthlySummary,
  availabilityFor,
  weekdayOf,
} from "../../models/TimesheetModel.js";
import { downloadEmployeeTimesheetPdf } from "../../utils/exportTimesheetPdf.js";
import { useT } from "../../i18n/i18n.jsx";

// ---------------------------------------------------------------------------
function PinGate({ employees, onUnlock }) {
  const { t } = useT();
  const [picked, setPicked] = useState(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const ok = await TimesheetService.verifyPin(picked.id, pin);
      if (ok) onUnlock(picked);
      else {
        setError(t("ts_wrongPin"));
        setPin("");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!picked) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-n-500 px-1">{t("ts_whoAreYou")}</p>
        {employees.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => {
              setPicked(e);
              setPin("");
              setError("");
            }}
            className="w-full text-left bg-n-0 border border-n-200 rounded-xl px-4 py-3 font-medium text-n-800 hover:border-accent-300 hover:bg-accent-50 dark:hover:bg-accent-900/20 transition"
          >
            {e.name}
          </button>
        ))}
        {employees.length === 0 && (
          <p className="text-center text-n-400 py-8 text-sm">{t("ts_noStaff")}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-n-0 border border-n-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPicked(null)}
          className="h-9 w-9 grid place-items-center rounded-lg border border-n-200 text-n-500"
          aria-label="back"
        >
          ‹
        </button>
        <span className="font-bold text-n-900">{picked.name}</span>
      </div>
      <label className="block">
        <span className="text-xs text-n-500">{t("ts_enterPin")}</span>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="mt-1 w-full h-12 text-center tracking-[0.5em] text-xl rounded-xl bg-n-0 border border-n-300 text-n-900 outline-none focus:ring-2 focus:ring-accent-500"
        />
      </label>
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="w-full py-3 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-bold disabled:opacity-40"
      >
        {busy ? "…" : t("ts_unlock")}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
const blankEntry = () => ({
  workDate: todayStr(),
  startTime: "",
  endTime: "",
  breakMinutes: "",
  note: "",
});

function HoursTab({ employee }) {
  const { t } = useT();
  const monthId = currentMonthId();
  const entriesQuery = useTimesheetMonth(monthId, employee.id);
  const save = useSaveEntry();
  const remove = useRemoveEntry();
  const [draft, setDraft] = useState(blankEntry);
  const [error, setError] = useState("");

  // Memoised because `?? []` would hand useMemo a brand-new array on every
  // render, defeating both memos below.
  const entries = useMemo(() => entriesQuery.data || [], [entriesQuery.data]);
  const summary = useMemo(() => monthlySummary(entries, monthId), [entries, monthId]);
  // Newest day first: the shift you just logged should be the one you can see.
  const days = useMemo(() => byDay(entries).reverse(), [entries]);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = async () => {
    setError("");
    try {
      await save.mutateAsync({ ...draft, employeeId: employee.id });
      setDraft(blankEntry());
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-n-0 border border-n-200 rounded-2xl p-3 space-y-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-n-500">
          {t("ts_addHours")}
        </div>
        <input
          type="date"
          value={draft.workDate}
          max={todayStr()}
          onChange={(e) => set("workDate", e.target.value)}
          className="w-full h-11 px-2 rounded-lg bg-n-0 border border-n-300 text-n-900 outline-none focus:ring-2 focus:ring-accent-500"
        />
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-n-400">{t("ts_start")}</span>
            <input
              type="time"
              value={draft.startTime}
              onChange={(e) => set("startTime", e.target.value)}
              className="h-11 px-2 rounded-lg bg-n-0 border border-n-300 text-n-900 outline-none focus:ring-2 focus:ring-accent-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-n-400">{t("ts_end")}</span>
            <input
              type="time"
              value={draft.endTime}
              onChange={(e) => set("endTime", e.target.value)}
              className="h-11 px-2 rounded-lg bg-n-0 border border-n-300 text-n-900 outline-none focus:ring-2 focus:ring-accent-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-n-400">{t("ts_break")}</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={draft.breakMinutes}
              onChange={(e) => set("breakMinutes", e.target.value)}
              className="h-11 px-2 text-center rounded-lg bg-n-0 border border-n-300 text-n-900 outline-none focus:ring-2 focus:ring-accent-500"
            />
          </label>
        </div>
        <input
          type="text"
          maxLength={200}
          value={draft.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder={t("ts_notePlaceholder")}
          className="w-full px-3 py-2 text-sm rounded-lg bg-n-0 border border-n-300 text-n-700 outline-none focus:ring-2 focus:ring-accent-500"
        />
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={save.isPending}
          className="w-full py-3 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-bold disabled:opacity-40"
        >
          {save.isPending ? t("saving") : t("ts_addHours")}
        </button>
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-bold text-n-900">
          {t("ts_monthTotal", { total: summary.formatted })}
        </span>
        <button
          type="button"
          onClick={() => downloadEmployeeTimesheetPdf(employee, entries, monthId)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-n-0 border border-n-200 text-n-600"
        >
          {t("exportPdf")}
        </button>
      </div>

      {entriesQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-2">
          {days.map((day) => (
            <div key={day.date} className="bg-n-0 border border-n-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-n-800">{formatDay(day.date)}</span>
                <span className="text-sm font-bold text-accent-700 dark:text-accent-300">
                  {formatMinutes(day.minutes)}
                </span>
              </div>
              {day.entries.map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-xs py-0.5">
                  <span className="text-n-700">
                    {e.startTime} – {e.endTime}
                  </span>
                  {e.breakMinutes > 0 && (
                    <span className="text-n-400">−{e.breakMinutes}m</span>
                  )}
                  <span className="flex-1 min-w-0 truncate text-n-400">{e.note}</span>
                  <span className="text-n-500">{formatMinutes(entryMinutes(e))}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t("ts_removeConfirm"))) remove.mutate(e.id);
                    }}
                    className="h-6 w-6 grid place-items-center rounded text-n-400 hover:text-rose-600 dark:hover:text-rose-400"
                    aria-label="remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ))}
          {days.length === 0 && (
            <p className="text-center text-n-400 py-8 text-sm">{t("ts_noHours")}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function AvailabilityTab({ employee }) {
  const { t } = useT();
  const from = todayStr();
  const availQuery = useAvailability(employee.id, from);
  const saveAvail = useSaveAvailability();
  const data = availQuery.data || { weekly: [], exceptions: [] };

  // The next 21 days: far enough ahead to plan a rota, short enough to stay a
  // list you can thumb through rather than a calendar you have to navigate.
  const upcoming = useMemo(
    () => Array.from({ length: 21 }, (_, i) => shiftDateStr(from, i)),
    [from],
  );

  const toggleWeekly = (weekday) => {
    const cur = data.weekly.find((w) => w.weekday === weekday);
    saveAvail.mutate({
      kind: "weekly",
      employeeId: employee.id,
      key: weekday,
      value: { available: !(cur?.available ?? false) },
    });
  };

  // Three states, cycled by tapping: follows the weekly pattern -> available
  // -> not available -> back. Clearing writes no row at all, which is what
  // "just use my normal week" means.
  const cycleDate = (date) => {
    const ex = data.exceptions.find((x) => x.onDate === date);
    const next = !ex ? { available: true } : ex.available ? { available: false } : null;
    saveAvail.mutate({ kind: "date", employeeId: employee.id, key: date, value: next });
  };

  if (availQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-n-0 border border-n-200 rounded-2xl p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-n-500 mb-2">
          {t("ts_usualWeek")}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((label, wd) => {
            const on = data.weekly.find((w) => w.weekday === wd)?.available ?? false;
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleWeekly(wd)}
                aria-pressed={on}
                className={`py-2 rounded-lg text-[11px] font-bold transition ${
                  on
                    ? "bg-accent-600 text-white"
                    : "bg-n-100 text-n-500 border border-n-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-n-400 mt-2">{t("ts_usualWeekHint")}</p>
      </div>

      <div className="bg-n-0 border border-n-200 rounded-2xl p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-n-500 mb-2">
          {t("ts_next3Weeks")}
        </div>
        <div className="space-y-1">
          {upcoming.map((date) => {
            const a = availabilityFor(date, data);
            const isException = a.source === "exception";
            return (
              <button
                key={date}
                type="button"
                onClick={() => cycleDate(date)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-n-50 text-left"
              >
                <span className="w-10 text-[11px] font-bold text-n-400">
                  {WEEKDAYS[weekdayOf(date)]}
                </span>
                <span className="flex-1 text-sm text-n-700">{formatDay(date)}</span>
                <span
                  className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                    a.available === true
                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                      : a.available === false
                        ? "bg-n-100 text-n-500"
                        : "bg-n-100 text-n-400"
                  }`}
                >
                  {a.available === true
                    ? t("ts_available")
                    : a.available === false
                      ? t("ts_notAvailable")
                      : t("ts_unset")}
                </span>
                {isException && (
                  <span className="text-[10px] text-accent-700 dark:text-accent-300 font-bold">•</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-n-400 mt-2">{t("ts_exceptionHint")}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export default function TimesheetPanel() {
  const { t } = useT();
  const { employees, isLoading } = useEmployees({ activeOnly: true });
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("hours");

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center gap-2">
        <span className="h-9 w-9 grid place-items-center rounded-xl bg-accent-600 text-white shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-n-900 leading-tight">{t("timesheet")}</h2>
          <p className="text-xs text-n-500 truncate">
            {me ? me.name : t("timesheet_desc")}
          </p>
        </div>
        {me && (
          <button
            type="button"
            onClick={() => setMe(null)}
            className="ml-auto shrink-0 text-xs font-semibold px-3 py-2 rounded-lg bg-n-0 border border-n-200 text-n-600"
          >
            {t("ts_switch")}
          </button>
        )}
      </div>

      {!me ? (
        <PinGate employees={employees} onUnlock={setMe} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["hours", t("ts_hours")],
              ["availability", t("ts_availability")],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
                className={`py-2 rounded-xl border text-sm font-semibold transition ${
                  tab === key
                    ? "bg-accent-600 border-accent-600 text-white"
                    : "bg-n-0 border-n-200 text-n-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "hours" ? <HoursTab employee={me} /> : <AvailabilityTab employee={me} />}
        </>
      )}
    </div>
  );
}
