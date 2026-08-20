// src/components/StaffAdmin.jsx
//
// The admin Staff tab: the roster, PINs, and everyone's hours for a month.
//
// It lives outside the Sales tab because the employee list is no longer a DSR
// detail — the timesheet reads the same roster, and burying it under a sales
// report made it look like one report's private setting.
import React, { useMemo, useState } from "react";
import Spinner from "./ui/Spinner.jsx";
import EmployeeManagerModal from "./dsr/EmployeeManagerModal.jsx";
import AvailabilityAdmin from "./AvailabilityAdmin.jsx";
import RotaAdmin from "./RotaAdmin.jsx";
import { useEmployees } from "../hooks/useEmployees.js";
import { useTimesheetMonth } from "../hooks/useTimesheet.js";
import { TimesheetService } from "../services/TimesheetService.js";
import { monthlyByEmployee, formatMinutes } from "../models/TimesheetModel.js";
import {
  currentMonthId,
  prevMonthId,
  nextMonthId,
  formatDay,
} from "../utils/monthUtils.js";
import {
  monthLabel,
  downloadTeamTimesheetPdf,
  downloadEmployeeTimesheetPdf,
} from "../utils/exportTimesheetPdf.js";
import { byDay } from "../models/TimesheetModel.js";
import { useT } from "../i18n/i18n.jsx";

// Set or clear one employee's PIN. The value is sent to an RPC that hashes it;
// the plaintext is never stored and never comes back.
function PinRow({ employee, onDone }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (value) => {
    setBusy(true);
    setError("");
    try {
      await TimesheetService.setPin(employee.id, value);
      setOpen(false);
      setPin("");
      onDone?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-n-0 border border-n-200 text-n-600"
      >
        {t("ts_setPin")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="password"
        inputMode="numeric"
        maxLength={8}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        placeholder="4–8"
        className="w-20 h-8 text-center rounded-lg bg-n-0 border border-n-300 text-n-900 text-sm outline-none focus:ring-2 focus:ring-accent-500"
      />
      <button
        type="button"
        disabled={busy || pin.length < 4}
        onClick={() => save(pin)}
        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-accent-600 text-white disabled:opacity-40"
      >
        {t("save")}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => save(null)}
        title={t("ts_clearPinHint")}
        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-n-0 border border-n-200 text-n-500"
      >
        {t("ts_clearPin")}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[11px] px-1.5 text-n-400"
      >
        ×
      </button>
      {error && <span className="text-[11px] text-rose-600 dark:text-rose-400">{error}</span>}
    </div>
  );
}

export default function StaffAdmin() {
  const { t } = useT();
  // Hours is what gets paid, so it leads. Availability is the planning view.
  const [section, setSection] = useState("hours"); // 'hours' | 'availability'
  const [monthId, setMonthId] = useState(currentMonthId());
  const [managing, setManaging] = useState(false);
  const [openEmployee, setOpenEmployee] = useState(null);

  const { employees, isLoading: loadingEmployees, refetch } = useEmployees();
  const entriesQuery = useTimesheetMonth(monthId);
  const entries = useMemo(() => entriesQuery.data || [], [entriesQuery.data]);

  const rows = useMemo(
    () => monthlyByEmployee(entries, monthId, employees),
    [entries, monthId, employees],
  );
  const totalMinutes = rows.reduce((n, r) => n + r.minutes, 0);
  const canGoNext = monthId < currentMonthId();

  const openDays = useMemo(() => {
    if (!openEmployee) return [];
    return byDay(entries.filter((e) => e.employeeId === openEmployee.employeeId)).reverse();
  }, [entries, openEmployee]);

  if (loadingEmployees) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {managing && (
        <EmployeeManagerModal
          onClose={() => {
            setManaging(false);
            refetch();
          }}
        />
      )}

      {/* Three jobs, three sections. They were stacked on one screen — a month
          navigator, two buttons, an hours list and the whole roster with PIN
          controls — and the page asked you to scroll past two of them to reach
          whichever one you came for. */}
      <div className="flex gap-1 bg-n-100 rounded-xl p-1">
        {[
          ["hours", t("ts_hoursSection")],
          ["availability", t("ts_availability")],
          ["rota", t("rota_section")],
          ["people", t("ts_peopleSection")],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
              section === id ? "bg-n-0 text-n-900 shadow-sm" : "text-n-500 hover:text-n-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "availability" ? (
        <AvailabilityAdmin />
      ) : section === "rota" ? (
        <RotaAdmin />
      ) : section === "people" ? (
        // The roster and its PINs. Its own section because it includes people
        // who worked no hours this month, and because "who works here" is a
        // different question from "what did they work".
        <>
          <button
            type="button"
            onClick={() => setManaging(true)}
            className="w-full py-2.5 rounded-xl bg-accent-600 border border-accent-600 text-white font-semibold"
          >
            {t("ts_manageStaff")}
          </button>

          <div className="bg-n-0 border border-n-200 rounded-2xl">
            <div className="px-3 py-2 border-b border-n-100 text-[11px] font-semibold uppercase tracking-wide text-n-500">
              {t("ts_pins")}
            </div>
            <div className="divide-y divide-n-100">
              {employees.map((e) => (
                <div key={e.id} className="flex items-center gap-2 px-3 py-2">
                  <span
                    className={`flex-1 min-w-0 truncate text-sm ${
                      e.active === false ? "text-n-400 line-through" : "text-n-800"
                    }`}
                  >
                    {e.name}
                  </span>
                  <PinRow employee={e} onDone={refetch} />
                </div>
              ))}
              {employees.length === 0 && (
                <p className="text-center text-n-400 py-8 text-sm">{t("ts_noStaff")}</p>
              )}
            </div>
            <p className="px-3 py-2 text-[11px] text-n-400">{t("ts_pinHint")}</p>
          </div>
        </>
      ) : (
        <>
      {/* Month navigator, with the team total under it: the month and its
          total are one fact, and splitting them across two cards made the
          number look like a separate reading. */}
      <div className="bg-n-0 border border-n-200 rounded-2xl p-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMonthId(prevMonthId(monthId))}
            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-n-100 text-n-600 font-bold text-lg"
            aria-label="previous month"
          >
            ‹
          </button>
          <div className="text-center">
            <div className="font-bold text-n-900">{monthLabel(monthId)}</div>
            <div className="text-[11px] text-n-500">
              {t("ts_teamTotal", { total: formatMinutes(totalMinutes) })}
            </div>
          </div>
          <button
            onClick={() => canGoNext && setMonthId(nextMonthId(monthId))}
            disabled={!canGoNext}
            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-n-100 text-n-600 font-bold text-lg disabled:opacity-30"
            aria-label="next month"
          >
            ›
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled={rows.length === 0}
        onClick={() => downloadTeamTimesheetPdf(employees, entries, monthId)}
        className="w-full py-2.5 rounded-xl bg-accent-600 border border-accent-600 text-white font-semibold disabled:opacity-40"
      >
        {t("exportPdf")}
      </button>

      {entriesQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="bg-n-0 border border-n-200 rounded-2xl divide-y divide-n-100">
          {rows.map((r) => (
            <div key={r.employeeId} className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setOpenEmployee(openEmployee?.employeeId === r.employeeId ? null : r)
                  }
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="font-semibold text-n-900 truncate">{r.employeeName}</div>
                  <div className="text-[11px] text-n-500">
                    {t("ts_daysWorked", { n: r.daysWorked })}
                  </div>
                </button>
                <span className="shrink-0 text-sm font-bold text-accent-700 dark:text-accent-300">
                  {r.formatted}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    downloadEmployeeTimesheetPdf(
                      { id: r.employeeId, name: r.employeeName },
                      entries.filter((e) => e.employeeId === r.employeeId),
                      monthId,
                    )
                  }
                  className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-n-0 border border-n-200 text-n-600"
                >
                  PDF
                </button>
              </div>

              {openEmployee?.employeeId === r.employeeId && (
                <div className="mt-2 space-y-1 border-t border-n-100 pt-2">
                  {openDays.map((day) => (
                    <div key={day.date} className="flex items-center gap-2 text-xs">
                      <span className="w-28 shrink-0 text-n-600">{formatDay(day.date)}</span>
                      <span className="flex-1 min-w-0 truncate text-n-400">
                        {day.entries
                          .map((e) => `${e.startTime}–${e.endTime}`)
                          .join(", ")}
                      </span>
                      <span className="shrink-0 font-semibold text-n-700">
                        {formatMinutes(day.minutes)}
                      </span>
                    </div>
                  ))}
                  {openDays.length === 0 && (
                    <p className="text-xs text-n-400 py-2">{t("ts_noHours")}</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-center text-n-400 py-8 text-sm">{t("ts_noHoursMonth")}</p>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}
