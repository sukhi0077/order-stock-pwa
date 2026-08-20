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
  useAvailabilityRange,
} from "../../hooks/useTimesheet.js";
import { useRotaMonth, useRotaStatus } from "../../hooks/useRota.js";
import { useFrontdesk } from "../../hooks/useFrontdesk.js";
import { TimesheetService } from "../../services/TimesheetService.js";
import { useBusinessDay } from "../../hooks/useBusinessDay.js";
import {
  currentMonthId,
  nextMonthId,
  prevMonthId,
  monthOf,
  todayStr,
  datesInMonth,
  shiftDateStr,
  formatDay,
  monthEndDate,
} from "../../utils/monthUtils.js";
import {
  WEEKDAYS,
  byDay,
  entryMinutes,
  formatMinutes,
  monthlySummary,
  availabilityFor,
  fillableDates,
  clearableDates,
  weeksOf,
  weekdayOf,
  groupAvailability,
  availabilityGrid,
  dayTallies,
  frontdeskAlertDates,
} from "../../models/TimesheetModel.js";
import { myShifts, shiftTimeLabel, isPublished } from "../../models/RotaModel.js";
import AvailabilityGrid from "./AvailabilityGrid.jsx";
import { downloadEmployeeTimesheetPdf } from "../../utils/exportTimesheetPdf.js";
import { downloadRotaPdf } from "../../utils/exportRotaPdf.js";
import { useT } from "../../i18n/i18n.jsx";

// ---------------------------------------------------------------------------
// A shared numeric field: same size and spacing whether you are entering a PIN
// or choosing one, so the second box on the setup screen doesn't read as a
// different kind of question.
function PinField({ label, value, onChange, onEnter, autoFocus }) {
  return (
    <label className="block">
      <span className="text-xs text-n-500">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        maxLength={8}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        className="mt-1 w-full h-12 text-center tracking-[0.5em] text-xl rounded-xl bg-n-0 border border-n-300 text-n-900 outline-none focus:ring-2 focus:ring-accent-500"
      />
    </label>
  );
}

function PinGate({ employees, onUnlock }) {
  const { t } = useT();
  const [picked, setPicked] = useState(null);
  // null while we ask the database; true = enter yours, false = choose one.
  const [hasPin, setHasPin] = useState(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const choose = async (person) => {
    setPicked(person);
    setPin("");
    setConfirmPin("");
    setError("");
    setHasPin(null);
    setBusy(true);
    try {
      setHasPin(await TimesheetService.hasPin(person.id));
    } catch (e) {
      // Can't tell — ask for a PIN rather than offering to set one. Guessing
      // "no PIN yet" on a network blip would invite someone to overwrite a
      // colleague's; the database would refuse, but only after the prompt.
      setHasPin(true);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

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

  // First time in: choose a PIN, typed twice. Nobody can recover a forgotten
  // one — the hash is one-way — so confirming here saves an admin reset later.
  const claim = async () => {
    if (pin.length < 4) return setError(t("ts_pinTooShort"));
    if (pin !== confirmPin) {
      setError(t("ts_pinMismatch"));
      setConfirmPin("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const claimed = await TimesheetService.claimPin(picked.id, pin);
      if (claimed) onUnlock(picked);
      else {
        // Someone set one between this screen loading and now.
        setHasPin(true);
        setPin("");
        setConfirmPin("");
        setError(t("ts_pinAlreadySet"));
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
            onClick={() => choose(e)}
            className="w-full text-left bg-n-0 border border-n-200 rounded-xl px-4 py-3 font-medium text-n-800 hover:border-accent-300 hover:bg-accent-50 dark:hover:bg-accent-900/20 transition"
          >
            {e.name}
          </button>
        ))}
        {employees.length === 0 && (
          <p className="text-center text-n-400 py-8 text-sm">{t("ts_noStaff")}</p>
        )}

        {/* The team rota download sits under the name list, deliberately set
            apart so it doesn't read as one more person to tap: a divider above
            it, and a lighter, icon-led style rather than the solid name rows. */}
        <div className="pt-3 mt-1 border-t border-n-200">
          <RotaDownloadButton />
        </div>
      </div>
    );
  }

  const setting = hasPin === false;

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

      {hasPin === null ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : setting ? (
        <>
          <p className="text-xs text-n-500">{t("ts_choosePinHint")}</p>
          <PinField
            label={t("ts_choosePin")}
            value={pin}
            onChange={setPin}
            autoFocus
          />
          <PinField
            label={t("ts_confirmPin")}
            value={confirmPin}
            onChange={setConfirmPin}
            onEnter={claim}
          />
        </>
      ) : (
        <PinField
          label={t("ts_enterPin")}
          value={pin}
          onChange={setPin}
          onEnter={submit}
          autoFocus
        />
      )}

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {hasPin !== null && (
        <button
          type="button"
          onClick={setting ? claim : submit}
          disabled={busy || pin.length < 4}
          className="w-full py-3 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-bold disabled:opacity-40"
        >
          {busy ? "…" : setting ? t("ts_savePin") : t("ts_unlock")}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
const blankEntry = () => ({
  startTime: "",
  endTime: "",
  note: "",
});

function HoursTab({ employee }) {
  const { t } = useT();
  // Not a constant: a phone left open across midnight has to start writing to
  // the new day, or the entry goes to yesterday and the database rejects it.
  const today = useBusinessDay();
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
      // workDate is set here, not held in the draft: it must be today at the
      // moment of saving, not whenever the form happened to be opened.
      await save.mutateAsync({ ...draft, workDate: today, employeeId: employee.id });
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
        {/* Today, and only today — no date picker.
            The rule is enforced in the database (ts_is_today), not here; this
            just stops the app offering a choice it would then refuse.

            The cost: a shift ending after midnight is already tomorrow by the
            clock. Log it before midnight — you know your finish time — or ask
            the admin. That friction is the deliberate price of a timesheet
            nobody can back-date. */}
        <div className="w-full h-11 px-3 rounded-lg bg-n-50 border border-n-200 flex items-center justify-between">
          <span className="font-semibold text-n-800">{formatDay(today)}</span>
          <span className="text-[11px] text-n-400">{t("ts_todayOnly")}</span>
        </div>
        {/* Start and end only — the two fields now share the row that used to
            hold a break, so each gets a wider, easier tap target. */}
        <div className="grid grid-cols-2 gap-2">
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
          {days.map((day) => {
            // Earlier days stay visible but read-only. Hiding them would make
            // the month look wrong; leaving the × there would offer a delete
            // the database refuses.
            const editable = day.date === today;
            return (
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
                    {editable ? (
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
                    ) : (
                      // Keeps the rows aligned with today's, which do have a ×.
                      <span className="h-6 w-6" aria-hidden="true" />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
          {days.length === 0 && (
            <p className="text-center text-n-400 py-8 text-sm">{t("ts_noHours")}</p>
          )}
        </div>
      )}
    </div>
  );
}

// One day in the calendar.
//
// Three states have to be distinguishable at a glance and while colour-blind,
// so each carries a mark as well as a colour: a tick for yes, a dash for no,
// and nothing at all for unanswered. The dot marks a day set explicitly, as
// opposed to one inherited from the usual week — otherwise there is no way to
// see which days you have actually replied to.
function DayCell({ date, state, past, onClick }) {
  const day = Number(date.slice(-2));
  // Only a day you tapped counts. A day the usual week merely implies is drawn
  // as a suggestion — outlined, not filled — because that is exactly what the
  // manager sees: nothing. Showing it solid green would tell you your answer
  // had been given when it had not.
  const answered = state.source === "exception";
  const yes = answered && state.available === true;
  const no = answered && state.available === false;
  const suggested = !answered && state.available === true;

  // Red for a day you have said you cannot work — leave, an appointment, a
  // second job. It was grey, which read as "nothing here" rather than "no",
  // and a booked holiday is not the absence of an answer.
  const tone = past
    ? "bg-n-50 text-n-300 border-n-100"
    : yes
      ? "bg-emerald-600 text-white border-emerald-600"
      : no
        ? "bg-rose-600 text-white border-rose-600"
        : suggested
          ? "bg-n-0 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 border-dashed"
          : "bg-n-0 text-n-400 border-n-200 border-dashed";

  return (
    <button
      type="button"
      onClick={past ? undefined : onClick}
      disabled={past}
      aria-label={date}
      aria-pressed={yes}
      className={`relative h-11 rounded-lg border text-[11px] font-bold leading-none flex flex-col items-center justify-center gap-0.5 transition ${tone}`}
    >
      <span>{day}</span>
      <span aria-hidden="true">{yes ? "✓" : no ? "✕" : suggested ? "·" : ""}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// The staff member's own shifts, once the owner has PUBLISHED the month. A
// draft month is deliberately invisible here — planning your week around shifts
// that are still being moved around is exactly what publishing exists to
// prevent. This month and next, from today on.
function MyRota({ employeeId }) {
  const { t } = useT();
  const from = todayStr();
  const thisMonth = monthOf(from);
  const nextMonth = nextMonthId(thisMonth);
  const thisQuery = useRotaMonth(thisMonth, employeeId);
  const nextQuery = useRotaMonth(nextMonth, employeeId);
  const thisStatus = useRotaStatus(thisMonth);
  const nextStatus = useRotaStatus(nextMonth);

  const shifts = useMemo(() => {
    const rows = [];
    if (isPublished(thisStatus.data?.status)) rows.push(...(thisQuery.data || []));
    if (isPublished(nextStatus.data?.status)) rows.push(...(nextQuery.data || []));
    return myShifts(rows, from);
  }, [thisQuery.data, nextQuery.data, thisStatus.data, nextStatus.data, from]);

  if (shifts.length === 0) return null;

  return (
    <div className="bg-n-0 border border-n-200 rounded-2xl p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-n-500 mb-2">
        {t("rota_myShifts")}
      </div>
      <div className="space-y-1">
        {shifts.map((s) => {
          const label = shiftTimeLabel(s);
          return (
            <div
              key={s.onDate}
              className="flex items-center justify-between text-sm py-0.5"
            >
              <span className="font-medium text-n-800">{formatDay(s.onDate)}</span>
              <span className="text-xs text-n-500">{label || t("rota_scheduled")}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-n-400 mt-2">{t("rota_myShiftsHint")}</p>
    </div>
  );
}

// Everyone's availability for a week, read-only — so a staff member can see who
// else is around before deciding whether to change their own answer. It is the
// admin's week grid minus the editing: same marks, same frozen name column, the
// reader's own row picked out in the accent colour.
function TeamAvailabilityView({ meId }) {
  const { t, tMonth } = useT();
  const [view, setView] = useState("week"); // 'week' | 'month'
  const [monthId, setMonthId] = useState(currentMonthId());
  const [weekStart, setWeekStart] = useState(
    () => shiftDateStr(todayStr(), -(weekdayOf(todayStr()) ?? 0)),
  );
  const dates = useMemo(
    () =>
      view === "month"
        ? datesInMonth(monthId)
        : Array.from({ length: 7 }, (_, i) => shiftDateStr(weekStart, i)),
    [view, monthId, weekStart],
  );
  const { employees } = useEmployees({ activeOnly: true });
  const availQuery = useAvailabilityRange(dates[0], dates[dates.length - 1]);

  const byPerson = useMemo(() => {
    const { weekly = [], exceptions = [] } = availQuery.data || {};
    return groupAvailability(weekly, exceptions);
  }, [availQuery.data]);
  const rows = useMemo(
    () => availabilityGrid(dates, employees, byPerson, { explicitOnly: true }),
    [dates, employees, byPerson],
  );
  const tallies = useMemo(() => dayTallies(dates, rows), [dates, rows]);
  const today = todayStr();

  const { ids: frontdeskIds } = useFrontdesk();
  const alertDates = useMemo(() => {
    const active = employees
      .filter((e) => e.active !== false && frontdeskIds.has(e.id))
      .map((e) => e.id);
    return frontdeskAlertDates(dates, active, byPerson);
  }, [dates, employees, frontdeskIds, byPerson]);

  const step = (dir) =>
    view === "month"
      ? setMonthId(dir < 0 ? prevMonthId(monthId) : nextMonthId(monthId))
      : setWeekStart(shiftDateStr(weekStart, dir * 7));

  return (
    <div className="bg-n-0 border border-n-200 rounded-2xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-n-500">
          {t("rota_teamAvail")}
        </div>
        <div className="flex gap-0.5 bg-n-100 rounded-lg p-0.5 shrink-0">
          {[
            ["week", t("ts_viewWeek")],
            ["month", t("ts_viewMonth")],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold transition ${
                view === id ? "bg-n-0 text-n-900 shadow-sm" : "text-n-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => step(-1)}
          className="h-7 w-7 grid place-items-center rounded-lg hover:bg-n-100 text-n-600 font-bold"
          aria-label="previous"
        >
          ‹
        </button>
        <span className="text-[11px] text-n-600 font-semibold whitespace-nowrap">
          {view === "month" ? tMonth(monthId) : `${formatDay(dates[0])} – ${formatDay(dates[6])}`}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          className="h-7 w-7 grid place-items-center rounded-lg hover:bg-n-100 text-n-600 font-bold"
          aria-label="next"
        >
          ›
        </button>
      </div>

      {availQuery.isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : employees.length === 0 ? (
        <p className="text-center text-n-400 py-4 text-sm">{t("ts_noStaff")}</p>
      ) : (
        <AvailabilityGrid
          dates={dates}
          rows={rows}
          today={today}
          compact={view === "month"}
          tallies={tallies}
          offLabel={t("ts_offCount")}
          highlightId={meId}
          alertDates={alertDates}
        />
      )}
      <p className="text-[11px] text-n-400">{t("rota_teamAvailHint")}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
function AvailabilityTab({ employee }) {
  const { t, tMonth } = useT();
  const from = todayStr();
  const availQuery = useAvailability(employee.id, from);
  const saveAvail = useSaveAvailability();
  const data = availQuery.data || { weekly: [], exceptions: [] };

  // This month and next, as calendars. A rolling 21-day list was easier to
  // build but harder to answer: a rota is planned per month, and "am I free on
  // the 14th" is a question about a grid, not a scroll.
  //
  // Past days of the current month are shown but not tappable — changing what
  // you were available for last Tuesday means nothing now.
  const months = useMemo(() => {
    const thisMonth = monthOf(from);
    return [thisMonth, nextMonthId(thisMonth)].map((monthId) => ({
      monthId,
      dates: datesInMonth(monthId),
      weeks: weeksOf(datesInMonth(monthId)),
    }));
  }, [from]);

  // Every date on screen, flat — the span a weekday tap fills across.
  const allDates = useMemo(() => months.flatMap((m) => m.dates), [months]);

  // Tapping a weekday is a bulk answer, not just a note to yourself: it fills
  // every blank day of that weekday, in both months, with "I can work".
  //
  // Only blank ones. A day already answered — green or, more importantly, red
  // for leave — is left alone. Losing a booked holiday to a stray tap on a
  // weekday chip is the one outcome this must never produce.
  //
  // Un-ticking it takes those days back out again, so the chip is a real
  // switch rather than a one-way action. Only the green ones go: a red day is
  // leave that happens to fall on a Tuesday, not a consequence of usually
  // working Tuesdays, and cancelling somebody's holiday from here would be
  // indefensible.
  const toggleWeekly = (weekday) => {
    const cur = data.weekly.find((w) => w.weekday === weekday);
    const turningOn = !(cur?.available ?? false);
    saveAvail.mutate({
      kind: "weekly",
      employeeId: employee.id,
      key: weekday,
      value: { available: turningOn },
    });

    const dates = turningOn
      ? fillableDates(allDates, weekday, from, data)
      : clearableDates(allDates, weekday, from, data);
    if (dates.length > 0) {
      saveAvail.mutate({
        kind: "dates",
        employeeId: employee.id,
        key: dates,
        value: turningOn ? { available: true } : null,
      });
    }
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
      <MyRota employeeId={employee.id} />

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

      {months.map(({ monthId, weeks }) => (
        <div key={monthId} className="bg-n-0 border border-n-200 rounded-2xl p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-n-500 mb-2">
            {tMonth(monthId)}
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((label) => (
              <span key={label} className="text-center text-[10px] font-bold text-n-400">
                {label}
              </span>
            ))}
          </div>

          <div className="space-y-1">
            {weeks.map((week, i) => (
              <div key={i} className="grid grid-cols-7 gap-1">
                {week.map((date, j) =>
                  date === null ? (
                    // Padding, so the 1st sits under the right weekday.
                    <span key={j} />
                  ) : (
                    <DayCell
                      key={date}
                      date={date}
                      state={availabilityFor(date, data)}
                      past={date < from}
                      onClick={() => cycleDate(date)}
                    />
                  ),
                )}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-n-400 mt-2">{t("ts_exceptionHint")}</p>
        </div>
      ))}

      <TeamAvailabilityView meId={employee.id} />
    </div>
  );
}

// The whole team's published rota, as a PDF anyone can save or print — offered
// on the timesheet home screen so a staff member does not need to sign in to
// see when everyone works. This month and next, from today on; a draft month is
// left out, exactly as it is hidden from "My shifts".
function RotaDownloadButton() {
  const { t } = useT();
  const from = todayStr();
  const thisMonth = monthOf(from);
  const nextMonth = nextMonthId(thisMonth);
  const { employees } = useEmployees({ activeOnly: true });
  const thisQuery = useRotaMonth(thisMonth);
  const nextQuery = useRotaMonth(nextMonth);
  const thisStatus = useRotaStatus(thisMonth);
  const nextStatus = useRotaStatus(nextMonth);

  const shifts = useMemo(() => {
    const rows = [];
    if (isPublished(thisStatus.data?.status)) rows.push(...(thisQuery.data || []));
    if (isPublished(nextStatus.data?.status)) rows.push(...(nextQuery.data || []));
    return rows.filter((s) => s.onDate >= from);
  }, [thisQuery.data, nextQuery.data, thisStatus.data, nextStatus.data, from]);

  const ready = shifts.length > 0 && employees.length > 0;

  const download = () =>
    downloadRotaPdf(
      employees,
      shifts,
      from,
      `${formatDay(from)} – ${formatDay(monthEndDate(nextMonth))}`,
    );

  return (
    <div>
      <button
        type="button"
        onClick={download}
        disabled={!ready}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 text-sm font-bold text-accent-700 dark:text-accent-300 hover:bg-accent-100 dark:hover:bg-accent-900/30 transition disabled:opacity-40 disabled:hover:bg-accent-50"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
          <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
        {t("rota_downloadPdf")}
      </button>
      {!ready && (
        <p className="text-[11px] text-n-400 mt-1.5 px-1 text-center">{t("rota_noPublished")}</p>
      )}
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
