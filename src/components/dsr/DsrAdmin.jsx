// src/components/AdminDashboard.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBusinessDay } from "../../hooks/useBusinessDay.js";
import { DailyReportService } from "../../services/DailyReportService.js";
import { DailyReportModel } from "../../models/DailyReportModel.js";
import { useDeliveryPlatforms } from "../../hooks/useDeliveryPlatforms.js";
import { todayStr, daysAgoStr, formatDateTime } from "../../utils/dateUtils.js";
import DailyReportForm from "./DailyReportForm.jsx";
import ReportDetailsModal from "./ReportDetailsModal.jsx";
import AdminTrends from "./AdminTrends.jsx";
import EmployeeManagerModal from "./EmployeeManagerModal.jsx";
import Spinner from "./ui/DsrSpinner.jsx";

// Currency display: always 2 decimals (stored numbers drop trailing zeros).
const money = (val) => (Number(val) || 0).toFixed(2);

// All dashboard date math is done on UTC-anchored calendar dates so the
// device's local timezone can NEVER shift a day. We seed from the business
// timezone (Europe/Warsaw) via todayStr(), then read/modify only with the
// getUTC*/setUTC* family. A UTC-midnight instant always formats to the same
// YYYY-MM-DD in Warsaw (which is east of UTC), so formatDate() stays correct.
const ymdToUTC = (str) => {
  const [y, m, d] = String(str).split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};
const fmtUTC = (d) => d.toISOString().slice(0, 10);

export default function AdminDashboard() {
  // Delivery portals are database rows now (public.delivery_platforms), so the
  // CSV columns follow whatever is configured rather than a hardcoded array.
  const { platforms } = useDeliveryPlatforms();
  const [viewMode, setViewMode] = useState("Day"); // 'Day', 'Week', 'Month'
  // Seed from "today" in the business timezone (Warsaw), not the device's day.
  const [currentDate, setCurrentDate] = useState(() => ymdToUTC(todayStr()));

  // If the app is left open past midnight, advance the Day view to the new
  // business day automatically (no restart needed). A ref keeps the effect
  // dependent only on the day change, not on every view switch.
  const businessDay = useBusinessDay();
  const viewModeRef = useRef(viewMode);
  // Written in an effect, not during render: mutating a ref while rendering is
  // unsafe under concurrent React (and flagged by react-hooks/refs).
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);
  const firstDayRun = useRef(true);
  useEffect(() => {
    if (firstDayRun.current) {
      firstDayRun.current = false;
      return;
    }
    if (viewModeRef.current === "Day") setCurrentDate(ymdToUTC(businessDay));
  }, [businessDay]);

  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  const [isGlobalEditMode, setIsGlobalEditMode] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null); // Controls the Read-Only Modal
  const [isAddingNew, setIsAddingNew] = useState(false); // Admin add past-day report
  const [isManagingStaff, setIsManagingStaff] = useState(false); // Staff list editor

  // Manual date range (used when viewMode === "Custom"). Defaults to Warsaw today.
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);

  const quarterOf = (d) => Math.floor(d.getUTCMonth() / 3) + 1;

  // --- DATE CALCULATION LOGIC (all in UTC → timezone-independent) ---
  const getDateRange = useCallback(() => {
    if (viewMode === "Custom") {
      // Guard against an inverted range (swap if From is after To).
      let s = ymdToUTC(customStart);
      let e = ymdToUTC(customEnd);
      if (s > e) [s, e] = [e, s];
      return { startDate: s, endDate: e };
    }

    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === "Week") {
      const day = start.getUTCDay();
      const diff = start.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday start
      start.setUTCDate(diff);
      end.setUTCDate(diff + 6);
    } else if (viewMode === "Month") {
      start.setUTCDate(1);
      end.setUTCMonth(end.getUTCMonth() + 1, 0); // Last day of the month
    } else if (viewMode === "Quarter") {
      const qStartMonth = Math.floor(start.getUTCMonth() / 3) * 3;
      start.setUTCMonth(qStartMonth, 1);
      end.setUTCMonth(qStartMonth + 3, 0); // Last day of the quarter's last month
    } else if (viewMode === "Year") {
      start.setUTCMonth(0, 1); // Jan 1
      end.setUTCMonth(11, 31); // Dec 31
    }
    return { startDate: start, endDate: end };
  }, [viewMode, currentDate, customStart, customEnd]);

  // Step backward (-1) / forward (+1) by one unit of the current view.
  const shiftPeriod = (dir) => {
    const d = new Date(currentDate);
    if (viewMode === "Day") d.setUTCDate(d.getUTCDate() + dir);
    else if (viewMode === "Week") d.setUTCDate(d.getUTCDate() + 7 * dir);
    else if (viewMode === "Month") {
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + dir);
    } else if (viewMode === "Quarter") {
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + 3 * dir);
    } else if (viewMode === "Year") {
      d.setUTCFullYear(d.getUTCFullYear() + dir);
    }
    setCurrentDate(d);
  };
  const handlePrev = () => shiftPeriod(-1);
  const handleNext = () => shiftPeriod(1);

  // --- CSV EXPORT (opens cleanly in Google Sheets via File -> Import) ---
  const csvEscape = (val) => {
    const s = val === null || val === undefined ? "" : String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const buildCsv = (data) => {
    const headers = [
      "Date",
      "Total Sale",
      "Bank Transfer",
      "Card Sale",
      "Cash Sale",
      "Fiskalne Match",
      "ING Match",
      ...platforms.flatMap((p) => [
        `${p} Online`,
        `${p} Cash`,
        `${p} Card`,
      ]),
      "Delivery Online Total",
      "Delivery Cash Total",
      "Delivery Card Total",
      "Portal Total",
      "Cash From Yesterday",
      "Expected Cash",
      "Total Cash In Box",
      "Cash Mismatch",
      "Mismatch Diff",
      "Online vs Portals Mismatch",
      "Coupons Given (Google Review)",
      "Received Coupons",
      "Coupons Count",
      "Coupons Detail",
      "Cash Taken Detail",
      "Cash Added Detail",
      "Reporter",
      "Submitted At",
      "Updated At",
      "Comments",
    ];

    // Blank instead of 0 for delivery cells (no sale on a portal).
    const blankZero = (v) => (Number(v) || 0) === 0 ? "" : Number(v);

    const rows = data.map((r) => {
      const delivery = r.delivery || {};
      const deliveryCells = platforms.flatMap((p) => [
        blankZero(delivery[p]?.online),
        blankZero(delivery[p]?.cash),
        blankZero(delivery[p]?.card),
      ]);
      const onlineTotal = blankZero(
        platforms.reduce(
          (s, p) => s + (Number(delivery[p]?.online) || 0),
          0,
        ),
      );
      const cashTotal = blankZero(
        platforms.reduce(
          (s, p) => s + (Number(delivery[p]?.cash) || 0),
          0,
        ),
      );
      const cardTotal = blankZero(
        platforms.reduce(
          (s, p) => s + (Number(delivery[p]?.card) || 0),
          0,
        ),
      );
      const couponsDetail = (r.couponsDetails || [])
        .map((c) => `${c.percentage}% @ ${c.posOrderNumber}`)
        .join(" | ");
      const cashTakenDetail = (r.cashTakenList || [])
        .map((c) => `${c.amount} (${c.reason})`)
        .join(" | ");
      const cashAddedDetail = (r.cashAddedList || [])
        .map((c) => `${c.amount} (${c.reason})`)
        .join(" | ");
      // Firestore Timestamps -> readable Warsaw-time string (device-independent)
      // Postgres timestamptz arrives as an ISO string (Firestore used to send
      // a { seconds } Timestamp object).
      const tsToStr = (ts) => (ts ? formatDateTime(ts) : "");

      return [
        r.dateString || "",
        r.totalSalePOS ?? "",
        r.onlineSalePOS ?? "",
        r.cardSalePOS ?? "",
        r.cashSalePOS ?? "",
        r.isMatchingFiskalne || "",
        r.isMatchingING || "",
        ...deliveryCells,
        onlineTotal,
        cashTotal,
        cardTotal,
        blankZero(
          (Number(onlineTotal) || 0) +
            (Number(cashTotal) || 0) +
            (Number(cardTotal) || 0),
        ),
        r.cashFromYesterday ?? "",
        r.autoCalculatedCash ?? "",
        r.totalCashInBox ?? "",
        r.cashMismatch ? "Yes" : "No",
        r.mismatchDiff ?? "",
        r.onlineSaleMismatch ? "Yes" : "No",
        (r.couponsGiven || []).map((e) => `${e.name} - ${e.count}`).join(", "),
        r.receivedCoupons || "",
        r.discountCoupons ?? "",
        couponsDetail,
        cashTakenDetail,
        cashAddedDetail,
        r.reporter || "",
        tsToStr(r.createdAt),
        tsToStr(r.updatedAt),
        r.comments || "",
      ];
    });

    // Totals row: sum every column whose cells are numbers; blank otherwise.
    const totals = new Array(headers.length).fill("");
    totals[0] = "TOTAL";
    for (let c = 1; c < headers.length; c++) {
      let hasNum = false;
      let sum = 0;
      for (const row of rows) {
        if (typeof row[c] === "number") {
          sum += row[c];
          hasNum = true;
        }
      }
      if (hasNum) totals[c] = Math.round((sum + Number.EPSILON) * 100) / 100;
    }

    // The "Coupons Given (Google Review)" column is text per row, so its TOTAL
    // cell would be blank. Instead, put the per-staff sum for the whole period
    // there, e.g. "Anna - 12, Marek - 8".
    const couponCol = headers.indexOf("Coupons Given (Google Review)");
    if (couponCol !== -1) {
      totals[couponCol] = DailyReportModel.aggregateCouponsByStaff(
        data.flatMap((r) => r.couponsGiven || []),
      )
        .map((e) => `${e.name} - ${e.count}`)
        .join(", ");
    }

    // Every numeric cell capped at 2 decimals (drops float drift/extra digits).
    const fmtCell = (v) =>
      typeof v === "number"
        ? String(Math.round((v + Number.EPSILON) * 100) / 100)
        : v;

    return [headers, ...rows, totals]
      .map((row) => row.map((cell) => csvEscape(fmtCell(cell))).join(","))
      .join("\n");
  };

  const downloadCsv = async (filename, csv) => {
    const content = "\uFEFF" + csv; // BOM so Sheets/Excel read UTF-8 correctly
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });

    // On a phone (especially an installed PWA on iOS, where <a download> is
    // unreliable) hand the file to the OS share sheet, so it can go to Files /
    // Drive / email. Desktop and anything without file-share support falls
    // through to a plain download.
    const file = new File([blob], filename, { type: "text/csv" });
    const canShareFile =
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });

    if (canShareFile) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
          text: "Daily reports export",
        });
        return;
      } catch (err) {
        // AbortError = the user dismissed the sheet; don't then force a
        // download they didn't ask for. Anything else falls through.
        if (err?.name === "AbortError") return;
        console.error("Share failed, falling back to download:", err);
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  // Always exports the FULL month that currentDate falls in, regardless of the
  // Day/Week/Month toggle, and fetches it fresh so nothing is missed.
  const handleDownloadCsv = async () => {
    setIsExporting(true);
    try {
      const y = currentDate.getUTCFullYear();
      const m = currentDate.getUTCMonth();
      const monthStart = new Date(Date.UTC(y, m, 1));
      const monthEnd = new Date(Date.UTC(y, m + 1, 0));
      const data = await DailyReportService.fetchAdminReports(
        monthStart,
        monthEnd,
      );
      if (!data.length) {
        alert("No reports found for the selected month.");
        return;
      }
      const sorted = [...data].sort((a, b) =>
        (a.dateString || "").localeCompare(b.dateString || ""),
      );
      const monthLabel = `${y}-${String(m + 1).padStart(2, "0")}`;
      await downloadCsv(`daily-reports-${monthLabel}.csv`, buildCsv(sorted));
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed: " + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  // --- DATA FETCHING (React Query: cached per date range) ---
  const { startDate, endDate } = getDateRange();
  const rangeKey = `${fmtUTC(startDate)}_${fmtUTC(endDate)}`;

  const {
    data: reports = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["adminReports", rangeKey],
    queryFn: () => DailyReportService.fetchAdminReports(startDate, endDate),
    staleTime: 60000, // re-use cached results for a minute (e.g. arrow back/forth)
    refetchOnWindowFocus: false,
  });

  // Re-fetch the currently shown range after an edit/add.
  const refreshReports = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["adminReports"] });
  }, [queryClient]);

  // Reports older than ~2 months can't be edited (enforced by the rules too).
  // Warsaw business date, independent of device timezone.
  const editCutoff = daysAgoStr(62);
  const canEdit = (r) => (r.dateString || "") >= editCutoff;

  // --- SUMMARY METRICS (memoized: recompute only when reports change) ---
  const {
    totalCash,
    totalOnline,
    totalCard,
    totalSale,
    totalCouponsGiven,
    totalCouponsReceived,
    currentCashInBox,
  } = useMemo(() => {
    // Coupons given are rows now (dsr_coupons, kind = 'given'), already
    // resolved to { employeeId, name, count } by the repository — no more
    // parsing a "person1 - 4, person2 - 5" string.
    const sumCouponsGiven = (list) =>
      (list || []).reduce((s, e) => s + (Number(e.count) || 0), 0);

    const acc = {
      totalCash: 0,
      totalOnline: 0,
      totalCard: 0,
      totalSale: 0,
      totalCouponsGiven: 0,
      totalCouponsReceived: 0,
    };
    let latest = null;
    for (const r of reports) {
      acc.totalCash += Number(r.cashSalePOS) || 0;
      acc.totalOnline += Number(r.onlineSalePOS) || 0;
      acc.totalCard += Number(r.cardSalePOS) || 0;
      acc.totalSale += Number(r.totalSalePOS) || 0;
      acc.totalCouponsGiven += sumCouponsGiven(r.couponsGiven);
      acc.totalCouponsReceived +=
        Number(r.discountCoupons) || r.couponsDetails?.length || 0;
      if (!latest || (r.dateString || "") > (latest.dateString || ""))
        latest = r;
    }
    return { ...acc, currentCashInBox: latest?.totalCashInBox };
  }, [reports]);

  // Per-staff Google-review coupon totals for the current view (in Month view
  // this is the monthly figure; the bonus reference). Source of truth = the
  // reports themselves, so it always matches the CSV.
  const couponsByStaff = useMemo(
    () =>
      DailyReportModel.aggregateCouponsByStaff(
        reports.flatMap((r) => r.couponsGiven || []),
      ),
    [reports],
  );

  // --- RENDER EDIT MODAL (Full Form View) ---
  if (editingRecord) {
    return (
      <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
        <div className="sticky top-0 bg-slate-100 p-4 shadow-md z-10 flex justify-between items-center border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">
            Editing Report: {editingRecord.dateString}
          </h2>
          <button
            onClick={() => setEditingRecord(null)}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold"
          >
            Cancel Edit
          </button>
        </div>
        <div className="p-4 md:p-8">
          <div className="max-w-2xl mx-auto">
            <DailyReportForm
              initialData={editingRecord}
              onSaved={() => {
                setEditingRecord(null);
                refreshReports();
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER ADD-NEW (Past-day) FORM ---
  if (isAddingNew) {
    return (
      <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
        <div className="sticky top-0 bg-slate-100 p-4 shadow-md z-10 flex justify-between items-center border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Add Report</h2>
          <button
            onClick={() => setIsAddingNew(false)}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold"
          >
            Cancel
          </button>
        </div>
        <div className="p-4 md:p-8">
          <div className="max-w-2xl mx-auto">
            <DailyReportForm
              createOptions={{
                allowBackdate: true,
                initialDate: fmtUTC(currentDate),
              }}
              onSaved={() => {
                setIsAddingNew(false);
                refreshReports();
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER MAIN DASHBOARD ---
  // Month name + year (e.g. "June 2026"), in UTC so it matches the UTC-anchored
  // currentDate and never shifts with the device timezone.
  const monthYearLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(currentDate);
  const dateDisplay =
    viewMode === "Day"
      ? fmtUTC(startDate)
      : viewMode === "Month"
        ? monthYearLabel
        : viewMode === "Quarter"
          ? `Q${quarterOf(currentDate)} ${currentDate.getUTCFullYear()}`
          : viewMode === "Year"
            ? `${currentDate.getUTCFullYear()}`
            : `${fmtUTC(startDate)} to ${fmtUTC(endDate)}`;

  const pickerInputClass =
    "bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-sky-500";

  return (
    <div className="px-4 md:px-8 pb-8 pt-28 max-w-6xl mx-auto text-slate-900">
      {/* Read-Only Details Modal */}
      <ReportDetailsModal
        report={viewingRecord}
        onClose={() => setViewingRecord(null)}
      />

      {/* Manage Staff Modal (Google-review coupon members) */}
      {isManagingStaff && (
        <EmployeeManagerModal onClose={() => setIsManagingStaff(false)} />
      )}

      {/* 1. HEADER & CONTROLS — minimal monoline: date + actions, then filters */}
      <div className="flex flex-col gap-4 mb-10">
        {/* Top line: date nav (left) + action links (right) */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-slate-200 pb-4">
          {/* Date nav, or manual range in Custom mode */}
          {viewMode === "Custom" ? (
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-sm text-slate-500">From</span>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className={pickerInputClass}
              />
              <span className="text-sm text-slate-500">To</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                onChange={(e) => setCustomEnd(e.target.value)}
                className={pickerInputClass}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrev}
                aria-label="Previous period"
                className="text-slate-400 hover:text-slate-900 text-xl leading-none transition"
              >
                &larr;
              </button>
              <span className="text-lg font-semibold tracking-tight text-slate-900">
                {dateDisplay}
              </span>
              <button
                onClick={handleNext}
                aria-label="Next period"
                className="text-slate-400 hover:text-slate-900 text-xl leading-none transition"
              >
                &rarr;
              </button>
            </div>
          )}

          {/* Action links */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium">
            <button
              onClick={() => setIsAddingNew(true)}
              className="text-sky-700 hover:text-sky-700 transition"
            >
              + Add
            </button>
            <button
              onClick={() => setIsManagingStaff(true)}
              className="text-slate-700 hover:text-slate-900 transition"
            >
              Manage Staff
            </button>
            <button
              onClick={handleDownloadCsv}
              disabled={isExporting}
              className="text-slate-700 hover:text-slate-900 transition disabled:opacity-50"
            >
              {isExporting ? "Preparing…" : "Export"}
            </button>
            <button
              onClick={() => setIsGlobalEditMode(!isGlobalEditMode)}
              className={`transition ${isGlobalEditMode ? "text-amber-700" : "text-slate-500 hover:text-slate-900"}`}
            >
              {isGlobalEditMode ? "Editing" : "Read only"}
            </button>
          </div>
        </div>

        {/* Filter line: quiet text links */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
          {["Day", "Week", "Month", "Quarter", "Year", "Custom"].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`transition ${viewMode === mode ? "text-slate-900" : "text-slate-400 hover:text-slate-700"}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* 2. SUMMARY CARDS — flat, minimal, accent dot */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-10">
        {[
          {
            label: "Cash in Box",
            value: currentCashInBox,
            dot: "bg-amber-500",
            text: "text-amber-700",
            isSnapshot: true,
          },
          {
            label: "Total Sale",
            value: totalSale,
            dot: "bg-sky-500",
            text: "text-sky-700",
          },
          {
            label: "Cash Sales",
            value: totalCash,
            dot: "bg-green-500",
            text: "text-green-700",
          },
          {
            label: "Online Sales",
            value: totalOnline,
            dot: "bg-blue-500",
            text: "text-blue-700",
          },
          {
            label: "Card Sales",
            value: totalCard,
            dot: "bg-violet-500",
            text: "text-violet-700",
          },
          {
            label: "Coupons",
            dot: "bg-pink-500",
            text: "text-pink-700",
            custom: (
              <span className="text-pink-700">
                {totalCouponsGiven}
                <span className="text-xs font-medium text-slate-500">
                  {" "}
                  given
                </span>
                <span className="text-slate-400"> · </span>
                {totalCouponsReceived}
                <span className="text-xs font-medium text-slate-500">
                  {" "}
                  rcvd
                </span>
              </span>
            ),
          },
        ].map((card) => (
          <div key={card.label} className="bg-slate-50 p-5 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className={`h-2 w-2 rounded-full ${card.dot}`} />
              <h3 className="text-slate-500 text-xs font-medium uppercase tracking-wider">
                {card.label}
              </h3>
            </div>
            <p className={`text-2xl font-bold tracking-tight ${card.text}`}>
              {card.custom
                ? card.custom
                : card.isSnapshot && card.value === undefined
                  ? "—"
                  : money(card.value)}
            </p>
          </div>
        ))}
      </div>

      {/* 2b. GOOGLE-REVIEW COUPONS BY STAFF (per-member sum for this period) */}
      {!isLoading && !isError && couponsByStaff.length > 0 && (
        <div className="bg-slate-100 rounded-xl border border-slate-200 p-5 mb-10">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Google-review coupons by staff
            </h3>
            <span className="text-xs text-slate-400">
              {viewMode} total ·{" "}
              <span className="text-pink-700 font-mono">
                {couponsByStaff.reduce((s, e) => s + e.count, 0)}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {couponsByStaff.map((e) => (
              <div
                key={e.name}
                className="flex items-center justify-between gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2"
              >
                <span className="text-sm text-slate-700 truncate">
                  {e.name}
                </span>
                <span className="text-sm font-bold font-mono text-pink-700">
                  {e.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. TRENDS / CHARTS */}
      {!isLoading && !isError && reports.length > 0 && (
        <AdminTrends reports={reports} />
      )}

      {/* 4. DATA TABLE */}
      <div className="bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-10">
            <Spinner label="Loading reports…" />
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-red-700">
            Couldn't load reports. Check your connection and try again.
          </div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No reports found for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-white border-b border-slate-200">
                  <th className="p-4 font-semibold text-slate-700">Date</th>
                  <th className="p-4 font-semibold text-slate-700">Reporter</th>
                  <th className="p-4 font-semibold text-slate-700">
                    Total Sale
                  </th>
                  <th className="p-4 font-semibold text-slate-700 text-green-700">
                    Cash
                  </th>
                  <th className="p-4 font-semibold text-slate-700 text-blue-700">
                    Card
                  </th>
                  <th className="p-4 font-semibold text-slate-700 text-emerald-700">
                    Bank Transfer
                  </th>
                  <th className="p-4 font-semibold text-slate-700 text-pink-700">
                    Coupons given
                  </th>
                  <th className="p-4 font-semibold text-slate-700 text-amber-700">
                    Coupons Rcvd
                  </th>
                  <th className="p-4 font-semibold text-slate-700">
                    Cash in Box
                  </th>
                  <th className="p-4 font-semibold text-slate-700">Status</th>
                  <th className="p-4 font-semibold text-center text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    className="border-b border-slate-200 hover:bg-slate-50 transition"
                  >
                    <td className="p-4 text-slate-700">{report.dateString}</td>
                    <td className="p-4 font-medium text-slate-900">
                      {report.reporter || "Unknown"}
                    </td>
                    <td className="p-4 text-slate-700">
                      {money(report.totalSalePOS)}
                    </td>
                    <td className="p-4 text-green-700">
                      {money(report.cashSalePOS)}
                    </td>
                    <td className="p-4 text-blue-700">
                      {money(report.cardSalePOS)}
                    </td>
                    <td className="p-4 text-emerald-700">
                      {money(report.onlineSalePOS)}
                    </td>
                    <td className="p-4 text-pink-700">
                      {(report.couponsGiven || [])
                        .map((e) => `${e.name} - ${e.count}`)
                        .join(", ") || "—"}
                    </td>
                    <td className="p-4 text-amber-700">
                      {report.receivedCoupons || 0}
                    </td>
                    <td className="p-4 font-bold text-green-700">
                      {money(report.totalCashInBox)}
                    </td>
                    <td className="p-4">
                      {(() => {
                        const flags = [];
                        if (report.cashMismatch)
                          flags.push(`Cash diff (${money(report.mismatchDiff)})`);
                        if (report.onlineSaleMismatch) {
                          const onlineDiff = Math.abs(
                            (Number(report.onlineSalePOS) || 0) -
                              (Number(report.deliveryOnlineTotal) || 0),
                          );
                          flags.push(`Online diff (${money(onlineDiff)})`);
                        }
                        if (report.isMatchingFiskalne === "No")
                          flags.push("Fiskalne");
                        if (report.isMatchingING === "No") flags.push("ING");

                        if (flags.length === 0) {
                          return (
                            <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded border border-green-200">
                              Balanced
                            </span>
                          );
                        }
                        return (
                          <div className="flex flex-wrap gap-1">
                            {flags.map((f) => (
                              <span
                                key={f}
                                className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded border border-red-200"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-4 flex items-center justify-center gap-2">
                      <button
                        onClick={() => setViewingRecord(report)}
                        className="px-3 py-1 bg-blue-50 hover:bg-blue-50 text-blue-700 border border-blue-200 rounded transition text-sm"
                      >
                        👁️ View
                      </button>

                      {isGlobalEditMode &&
                        (canEdit(report) ? (
                          <button
                            onClick={() => setEditingRecord(report)}
                            className="px-3 py-1 bg-amber-50 hover:bg-amber-50 text-amber-600 border border-amber-200 rounded transition text-sm"
                          >
                            ✏️ Edit
                          </button>
                        ) : (
                          <span
                            title="Reports older than 2 months can't be edited"
                            className="px-3 py-1 text-slate-400 border border-slate-200 rounded text-sm cursor-not-allowed"
                          >
                            🔒 Locked
                          </span>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
