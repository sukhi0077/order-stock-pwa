// src/components/ReportDetailsModal.jsx
import React from "react";
import { DailyReportModel } from "../../models/DailyReportModel.js";

// Currency formatter: always 2 decimals so values read like money (0.10).
// Stored numbers can't keep a trailing zero, so we format on display.
const money = (val) => (Number(val) || 0).toFixed(2);

export default function ReportDetailsModal({ report, onClose, embedded = false }) {
  if (!report) return null;

  // When embedded (e.g. staff read-only view), render inline instead of as a
  // full-screen fixed overlay, and hide the Close button.
  const wrapperClass = embedded
    ? ""
    : "fixed inset-0 bg-n-0/95 backdrop-blur-sm z-[100] overflow-y-auto p-4 md:p-8";
  const innerClass = embedded
    ? "bg-n-100 rounded-2xl border border-n-200 shadow-2xl overflow-hidden"
    : "max-w-4xl mx-auto bg-n-100 rounded-2xl border border-n-200 shadow-2xl overflow-hidden";

  return (
    <div className={wrapperClass}>
      <div className={innerClass}>
        {/* Header */}
        <div className="bg-n-0 p-6 border-b border-n-200 flex justify-between items-center sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-n-900">Report Details</h2>
            <p className="text-n-500 text-sm mt-1">
              Date:{" "}
              <span className="text-accent-700 dark:text-accent-300 font-bold">
                {report.dateString}
              </span>{" "}
              | Reporter:{" "}
              <span className="text-accent-700 dark:text-accent-300 font-bold ml-1">
                {report.reporter || "Unknown"}
              </span>
            </p>
          </div>
          {!embedded && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-n-200 hover:bg-n-200 text-n-900 rounded-lg font-bold transition"
            >
              ✕ Close
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 md:p-8 space-y-8">
          {/* POS Summary */}
          <section>
            <h3 className="text-lg font-semibold text-n-700 border-b border-n-200 pb-2 mb-4">
              POS Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-n-0 p-4 rounded-xl border border-n-200">
                <p className="text-xs text-n-500 uppercase tracking-wider">
                  Total Sale
                </p>
                <p className="text-xl font-bold text-n-900">
                  {money(report.totalSalePOS)}
                </p>
              </div>
              <div className="bg-n-0 p-4 rounded-xl border border-n-200">
                <p className="text-xs text-n-500 uppercase tracking-wider">
                  Card Sale
                </p>
                <p className="text-xl font-bold text-accent-700 dark:text-accent-300">
                  {money(report.cardSalePOS)}
                </p>
              </div>
              <div className="bg-n-0 p-4 rounded-xl border border-n-200">
                <p className="text-xs text-n-500 uppercase tracking-wider">
                  Cash Sale
                </p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                  {money(report.cashSalePOS)}
                </p>
              </div>
              <div
                className={`p-4 rounded-xl border ${report.onlineSaleMismatch ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40" : "bg-n-0 border-n-200"}`}
              >
                <p className="text-xs text-n-500 uppercase tracking-wider">
                  Online Sale
                </p>
                <p
                  className={`text-xl font-bold ${report.onlineSaleMismatch ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}
                >
                  {money(report.onlineSalePOS)}
                </p>
                {report.onlineSaleMismatch && (
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1 leading-snug">
                    Off by{" "}
                    {money(
                      Math.abs(
                        (Number(report.onlineSalePOS) || 0) -
                          (Number(report.deliveryOnlineTotal) || 0),
                      ),
                    )}{" "}
                    — portals online total is{" "}
                    {money(report.deliveryOnlineTotal)}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Cash Drawer Details */}
          <section>
            <h3 className="text-lg font-semibold text-n-700 border-b border-n-200 pb-2 mb-4">
              Cash Drawer
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-n-0 p-4 rounded-xl border border-n-200">
                <p className="text-xs text-n-500 uppercase tracking-wider">
                  Opening Cash (carried over)
                </p>
                <p className="text-lg font-bold text-n-900">
                  {money(report.cashFromYesterday)}
                </p>
              </div>
              <div
                className={`p-4 rounded-xl border ${report.cashMismatch ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40" : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/40"}`}
              >
                <p className="text-xs text-n-500 uppercase tracking-wider">
                  Reported Cash in Box
                </p>
                <p
                  className={`text-xl font-bold ${report.cashMismatch ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"}`}
                >
                  {money(report.totalCashInBox)}
                </p>
                {report.cashMismatch && (
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1 leading-snug">
                    Off by {money(report.mismatchDiff)} — expected cash is{" "}
                    {money(report.autoCalculatedCash)}
                  </p>
                )}
              </div>
            </div>

            {/* Cash Adjustments — one merged list of taken (−) and added (+) */}
            {(() => {
              const adjustments = [
                ...(report.cashTakenList || []).map((e) => ({
                  ...e,
                  kind: "taken",
                })),
                ...(report.cashAddedList || []).map((e) => ({
                  ...e,
                  kind: "added",
                })),
              ].sort((a, b) => (a.seq || 0) - (b.seq || 0));
              if (adjustments.length === 0) return null;
              return (
                <div className="bg-n-0 p-4 rounded-xl border border-n-200">
                  <p className="text-sm font-semibold text-n-700 mb-2">
                    Cash Adjustments:
                  </p>
                  <ul className="space-y-2">
                    {adjustments.map((item, idx) => {
                      const taken = item.kind === "taken";
                      const chip = taken
                        ? "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40"
                        : "text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/40";
                      const amtColor = taken
                        ? "text-red-700 dark:text-red-300"
                        : "text-green-700 dark:text-green-300";
                      return (
                        <li
                          key={idx}
                          className="flex items-center gap-2 bg-n-100 p-2 rounded"
                        >
                          <span
                            className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full font-bold border ${chip}`}
                          >
                            {taken ? "−" : "+"}
                          </span>
                          <span className="flex-1 min-w-0 text-n-700 truncate">
                            {item.reason}
                          </span>
                          <span className={`font-bold font-mono ${amtColor}`}>
                            {taken ? "−" : "+"}
                            {money(item.amount)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })()}
          </section>

          {/* Delivery Platforms */}
          <section>
            <h3 className="text-lg font-semibold text-n-700 border-b border-n-200 pb-2 mb-4">
              Delivery Breakdown
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {report.delivery &&
                Object.entries(report.delivery).map(([platform, data]) => {
                  if (!data.online && !data.cash && !data.card) return null; // Hide empty platforms
                  return (
                    <div
                      key={platform}
                      className="bg-n-0 p-4 rounded-xl border border-n-200"
                    >
                      <p className="text-sm font-bold text-n-800 mb-2">
                        {platform}
                      </p>
                      <div className="flex justify-between text-sm">
                        <span className="text-n-500">Online:</span>
                        <span className="text-accent-700 dark:text-accent-300 font-mono">
                          {money(data.online)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-n-500">Cash:</span>
                        <span className="text-green-700 dark:text-green-300 font-mono">
                          {money(data.cash)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-n-500">Card:</span>
                        <span className="text-accent-700 dark:text-accent-300 font-mono">
                          {money(data.card)}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>

          {/* Coupons */}
          <section>
            <h3 className="text-lg font-semibold text-n-700 border-b border-n-200 pb-2 mb-4">
              Coupons
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-n-0 p-4 rounded-xl border border-n-200">
                <p className="text-xs text-n-500 uppercase tracking-wider mb-1">
                  Given (Google Review)
                </p>
                {(() => {
                  // One row per employee from dsr_coupons (kind = 'given'),
                  // already resolved to names by the repository.
                  const entries = report.couponsGiven || [];
                  if (entries.length === 0) {
                    return <span className="text-n-400 italic">None</span>;
                  }
                  const total = entries.reduce(
                    (s, e) => s + (Number(e.count) || 0),
                    0,
                  );
                  return (
                    <div className="space-y-1">
                      {entries.map((e) => (
                        <div
                          key={e.name}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="text-n-700 truncate">
                            {e.name}
                          </span>
                          <span className="font-mono text-n-800">
                            {Number(e.count) || 0}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-3 text-sm border-t border-n-200 mt-1 pt-1">
                        <span className="text-n-500">Total</span>
                        <span className="font-mono text-accent-700 dark:text-accent-300 font-bold">
                          {total}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="bg-n-0 p-4 rounded-xl border border-n-200">
                <p className="text-xs text-n-500 uppercase tracking-wider mb-1">
                  Received / Discount given
                </p>
                {report.receivedCoupons === "Yes" &&
                report.couponsDetails &&
                report.couponsDetails.length > 0 ? (
                  <ul className="space-y-1.5 mt-1">
                    {report.couponsDetails.map((c, idx) => (
                      <li
                        key={idx}
                        className="flex justify-between items-center bg-n-100 px-2 py-1.5 rounded text-sm"
                      >
                        <span className="text-accent-700 dark:text-accent-300 font-bold">
                          {c.percentage}%
                        </span>
                        <span className="text-n-500">
                          Order {c.posOrderNumber}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-n-400 italic">None</p>
                )}
              </div>
            </div>
          </section>

          {/* Comments */}
          <section>
            <h3 className="text-lg font-semibold text-n-700 border-b border-n-200 pb-2 mb-4">
              Comments / Issues
            </h3>
            <div className="bg-n-0 p-4 rounded-xl border border-n-200 min-h-[100px] text-n-700 whitespace-pre-wrap">
              {report.comments || (
                <span className="text-n-400 italic">
                  No comments provided.
                </span>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
