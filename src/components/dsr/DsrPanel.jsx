// src/components/StaffPanel.jsx
import React, { useState, useEffect, useCallback } from "react";
import DailyReportForm from "./DailyReportForm.jsx";
import ReportDetailsModal from "./ReportDetailsModal.jsx";
import Spinner from "./ui/DsrSpinner.jsx";
import { DailyReportService } from "../../services/DailyReportService.js";
import { todayStr } from "../../utils/dateUtils.js";
import { dsrOfflineQueue } from "../../utils/dsrOfflineQueue.js";

// Staff experience:
//  - No report yet today -> blank form to submit.
//  - Report exists today -> read-only view + Edit button (editable).
//  - Past 3 days         -> read-only history list (view only, no edits).
//  - Next day            -> today resets to a blank form automatically.
export default function StaffPanel() {
  const [recent, setRecent] = useState([]); // last 3 days, newest first
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [viewing, setViewing] = useState(null); // a past report (modal)

  // Business day (Warsaw). App remounts this panel (via key) when the day
  // rolls over, so this stays correct for the lifetime of the mount.
  const today = todayStr();

  const loadRecent = useCallback(async () => {
    try {
      // 2 calendar days = today + the one previous day.
      const data = await DailyReportService.fetchRecentReports(2);
      const sorted = [...data].sort((a, b) => {
        // by date desc, then newest submission first within a day
        if ((b.dateString || "") !== (a.dateString || ""))
          return (b.dateString || "").localeCompare(a.dateString || "");
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
      setRecent(sorted);
    } catch (e) {
      console.error("Couldn't load recent reports:", e);
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    DailyReportService.fetchRecentReports(2)
      .then((data) => {
        if (!active) return;
        const sorted = [...data].sort((a, b) => {
          if ((b.dateString || "") !== (a.dateString || ""))
            return (b.dateString || "").localeCompare(a.dateString || "");
          return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
        });
        setRecent(sorted);
      })
      .catch((e) => {
        console.error("Couldn't load recent reports:", e);
        if (active) setRecent([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Reload after queued offline reports get submitted in the background.
  useEffect(() => {
    const onSynced = () => loadRecent();
    window.addEventListener(dsrOfflineQueue.EVENT_SYNCED, onSynced);
    return () => window.removeEventListener(dsrOfflineQueue.EVENT_SYNCED, onSynced);
  }, [loadRecent]);

  const todayReport = recent.find((r) => r.dateString === today) || null;
  const pastReports = recent.filter((r) => r.dateString !== today);

  const handleSubmitted = () => loadRecent();
  const handleEdited = () => {
    setIsEditing(false);
    loadRecent();
  };

  if (isLoading) {
    return (
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-10">
        <Spinner />
      </div>
    );
  }

  // ---- EDIT MODE: editable form pre-filled with today's report ----
  if (todayReport && isEditing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-amber-700">
            Editing today's report
          </h2>
          <button
            onClick={() => setIsEditing(false)}
            className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:text-slate-900"
          >
            ← Cancel
          </button>
        </div>
        <DailyReportForm initialData={todayReport} onSaved={handleEdited} />
      </div>
    );
  }

  // Read-only modal for a past report
  const pastModal = (
    <ReportDetailsModal report={viewing} onClose={() => setViewing(null)} />
  );

  // Previous day's report(s) — a distinct, muted "archive" card.
  const historySection = pastReports.length > 0 && (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🗄️</span>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
          Previous Day
        </h3>
        <span className="text-[10px] text-slate-400 uppercase tracking-wider ml-auto">
          View only
        </span>
      </div>
      <div className="space-y-2">
        {pastReports.map((r) => (
          <div
            key={r.id}
            className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="font-bold text-slate-900">{r.dateString}</p>
              <p className="text-xs text-slate-500 truncate">
                {r.reporter || "Unknown"} · Total{" "}
                {(Number(r.totalSalePOS) || 0).toFixed(2)}
                {(r.cashMismatch || r.onlineSaleMismatch) && (
                  <span className="ml-2 text-red-700 font-semibold">
                    ⚠ check
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setViewing(r)}
              className="shrink-0 px-3 py-1.5 bg-blue-50 hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-semibold text-sm transition"
            >
              👁️ View
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  // ---- TODAY'S REPORT ALREADY SUBMITTED: read-only + edit ----
  // Keep the previous-day section in the SAME position as before submitting
  // (above), with the "Today's Report" header, so the layout doesn't shift.
  if (todayReport) {
    return (
      <div>
        {pastModal}
        {pastReports.length > 0 && (
          <div className="mb-6">
            {historySection}
            <div className="flex items-center gap-3 mt-8 mb-4">
              <span className="text-base">📝</span>
              <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider">
                Today's Report
              </h3>
              <div className="flex-1 border-t border-slate-200" />
            </div>
          </div>
        )}

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 flex items-center justify-between gap-3">
          <p className="text-green-700 font-semibold text-sm">
            ✅ Today's report has been submitted.
          </p>
          <button
            onClick={() => setIsEditing(true)}
            className="shrink-0 px-4 py-2 bg-amber-50 hover:bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-bold text-sm transition"
          >
            ✏️ Edit
          </button>
        </div>

        <ReportDetailsModal report={todayReport} onClose={null} embedded />
      </div>
    );
  }

  // ---- NO REPORT YET TODAY: show previous day ABOVE the blank form, so it
  //      isn't hidden behind the form's fixed bottom button bar. ----
  return (
    <div>
      {pastModal}
      {pastReports.length > 0 && (
        <div className="mb-6">
          {historySection}
          <div className="flex items-center gap-3 mt-8 mb-4">
            <span className="text-base">📝</span>
            <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider">
              Today's Report
            </h3>
            <div className="flex-1 border-t border-slate-200" />
          </div>
        </div>
      )}
      <DailyReportForm onSaved={handleSubmitted} />
    </div>
  );
}
