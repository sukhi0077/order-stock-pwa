// src/components/dsr/EmployeeManagerModal.jsx
import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { EmployeeService } from "../../services/EmployeeService.js";
import { useEmployees, EMPLOYEES_QUERY_KEY } from "../../hooks/useEmployees.js";

// Admin-only panel for the employee roster (public.employees). These people
// appear in two places on the report: the "Reporter" dropdown, and the
// "Coupons given for Google Review" steppers.
//
// REWRITTEN for the Supabase schema. The Firestore version edited a names
// ARRAY in one settings document and saved the whole thing at once. Employees
// are rows now, each referenced by foreign keys from dsr_reports and
// dsr_coupons, so:
//   * every change is saved immediately (no local working copy to get stale)
//   * nobody is DELETED — removing someone who has filed a report would
//     violate the ON DELETE RESTRICT foreign key. They are DEACTIVATED, which
//     hides them from the dropdown while their history stays intact.
export default function EmployeeManagerModal({ onClose }) {
  const queryClient = useQueryClient();
  // activeOnly: false — the admin needs to see inactive people to restore them.
  const { employees, isLoading } = useEmployees({ activeOnly: false });

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY });

  const handleAdd = async () => {
    const value = draft.trim();
    if (!value) return;
    setIsAdding(true);
    setError("");
    try {
      // Sort new people to the end of the list.
      await EmployeeService.add(value, employees.length);
      await refresh();
      setDraft("");
    } catch (e) {
      setError(e.message || "Failed to add that employee.");
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (emp) => {
    setEditingId(emp.id);
    setEditingName(emp.name);
    setError("");
  };

  const commitEdit = async () => {
    const value = editingName.trim();
    const id = editingId;
    if (!value || !id) {
      setEditingId(null);
      return;
    }
    setBusyId(id);
    setError("");
    try {
      await EmployeeService.rename(id, value);
      await refresh();
      setEditingId(null);
    } catch (e) {
      setError(e.message || "Failed to rename.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (emp) => {
    if (
      emp.active &&
      !window.confirm(
        `Deactivate ${emp.name}?\n\nThey'll disappear from the reporter dropdown and coupon list, but every report they've already filed stays exactly as it is. You can reactivate them any time.`,
      )
    ) {
      return;
    }
    setBusyId(emp.id);
    setError("");
    try {
      await EmployeeService.setActive(emp.id, !emp.active);
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to update.");
    } finally {
      setBusyId(null);
    }
  };

  const active = employees.filter((e) => e.active);
  const inactive = employees.filter((e) => !e.active);

  const row = (emp) => (
    <div
      key={emp.id}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${
        emp.active
          ? "bg-white border-slate-200"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      {editingId === emp.id ? (
        <input
          type="text"
          autoFocus
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit();
            }
            if (e.key === "Escape") setEditingId(null);
          }}
          className="flex-1 min-w-0 bg-slate-100 border border-pink-200 rounded-md px-2 py-1 text-sm text-slate-900 focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => emp.active && startEdit(emp)}
          className={`flex-1 min-w-0 text-left text-sm truncate ${
            emp.active
              ? "text-slate-800 hover:text-slate-900"
              : "text-slate-400 line-through"
          }`}
          title={emp.active ? "Tap to rename" : undefined}
        >
          {emp.name}
        </button>
      )}

      <button
        type="button"
        onClick={() => toggleActive(emp)}
        disabled={busyId === emp.id}
        className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold border transition disabled:opacity-40 ${
          emp.active
            ? "border-slate-300 text-slate-500 hover:text-red-700 hover:border-red-200"
            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        }`}
      >
        {emp.active ? "Deactivate" : "Restore"}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-100 w-full max-w-md rounded-2xl border border-slate-200 shadow-xl my-8">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Manage employees</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-500 hover:text-slate-900 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-slate-500 mb-4">
            These people appear in the report’s <strong>Reporter</strong>{" "}
            dropdown and in “Coupons given for Google Review”. Changes save
            immediately.
          </p>

          {/* Add new employee */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="Add an employee…"
              className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={isAdding || !draft.trim()}
              className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-pink-600 hover:bg-pink-500 text-white transition disabled:opacity-40"
            >
              {isAdding ? "…" : "Add"}
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-slate-400 italic">
              No employees yet. Add the first one above.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {active.map(row)}

              {inactive.length > 0 && (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 pt-3 pb-1">
                    Inactive · hidden from the app, history kept
                  </p>
                  {inactive.map(row)}
                </>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-700 font-medium">{error}</p>
          )}
        </div>

        <div className="flex justify-end p-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-pink-600 hover:bg-pink-500 text-white transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
