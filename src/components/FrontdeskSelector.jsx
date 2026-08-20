// src/components/FrontdeskSelector.jsx
//
// Admin picks which staff are on the front desk. The availability and rota
// screens then flag any day where every one of these people has booked off, so
// a day with nobody to cover the desk is caught before it arrives.
import React from "react";
import Spinner from "./ui/Spinner.jsx";
import { useEmployees } from "../hooks/useEmployees.js";
import { useFrontdesk, useSetFrontdesk } from "../hooks/useFrontdesk.js";
import { useT } from "../i18n/i18n.jsx";

export default function FrontdeskSelector() {
  const { t } = useT();
  const { employees, isLoading } = useEmployees({ activeOnly: true });
  const { ids, isLoading: loadingIds } = useFrontdesk();
  const setMember = useSetFrontdesk();

  return (
    <div className="bg-n-0 border border-n-200 rounded-2xl">
      <div className="px-3 py-2 border-b border-n-100 text-[11px] font-semibold uppercase tracking-wide text-n-500">
        {t("fd_title")}
      </div>

      {isLoading || loadingIds ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : employees.length === 0 ? (
        <p className="text-center text-n-400 py-6 text-sm">{t("ts_noStaff")}</p>
      ) : (
        <div className="flex flex-wrap gap-2 p-3">
          {employees.map((e) => {
            const on = ids.has(e.id);
            return (
              <button
                key={e.id}
                type="button"
                disabled={setMember.isPending}
                onClick={() => setMember.mutate({ employeeId: e.id, member: !on })}
                aria-pressed={on}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition disabled:opacity-50 ${
                  on
                    ? "bg-accent-600 border-accent-600 text-white"
                    : "bg-n-0 border-n-200 text-n-600 hover:border-accent-300"
                }`}
              >
                {on ? "✓ " : ""}
                {e.name}
              </button>
            );
          })}
        </div>
      )}

      <p className="px-3 py-2 text-[11px] text-n-400 border-t border-n-100">{t("fd_hint")}</p>
    </div>
  );
}
