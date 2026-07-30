// src/components/AdminTrends.jsx
import React, { useMemo } from "react";
import { useDeliveryPlatforms } from "../../hooks/useDeliveryPlatforms.js";

const money = (val) => (Number(val) || 0).toFixed(2);

// Lightweight, dependency-free trend charts for the admin dashboard.
// Memoized: only recomputes/re-renders when the `reports` array changes,
// so unrelated dashboard re-renders (e.g. toggling edit mode) are free.
function AdminTrends({ reports }) {
  // Delivery portals are database rows now, so the portal breakdown follows
  // whatever is configured rather than a hardcoded list.
  const { platforms } = useDeliveryPlatforms();

  // All aggregation in one memo so it isn't recomputed on every render.
  const agg = useMemo(() => {
    const list = reports || [];

    // by day
    const byDateMap = {};
    for (const r of list) {
      const d = r.dateString || "—";
      if (!byDateMap[d]) byDateMap[d] = { date: d, total: 0 };
      byDateMap[d].total += Number(r.totalSalePOS) || 0;
    }
    const days = Object.values(byDateMap).sort((a, b) =>
      (a.date || "").localeCompare(b.date || ""),
    );
    const maxDay = Math.max(1, ...days.map((d) => d.total));
    const periodTotal = days.reduce((s, d) => s + d.total, 0);
    const avgDay = days.length ? periodTotal / days.length : 0;
    const peakDay = days.reduce(
      (best, d) => (d.total > best.total ? d : best),
      days[0] || { date: "", total: 0 },
    );

    // payment mix
    const pay = list.reduce(
      (acc, r) => {
        acc.cash += Number(r.cashSalePOS) || 0;
        acc.card += Number(r.cardSalePOS) || 0;
        acc.online += Number(r.onlineSalePOS) || 0;
        return acc;
      },
      { cash: 0, card: 0, online: 0 },
    );
    const payTotal = pay.cash + pay.card + pay.online;

    // portal-wise sales
    const portalTotals = platforms.map((p) => {
      const total = list.reduce((sum, r) => {
        const d = (r.delivery && r.delivery[p]) || {};
        return (
          sum +
          (Number(d.online) || 0) +
          (Number(d.cash) || 0) +
          (Number(d.card) || 0)
        );
      }, 0);
      return { name: p, total };
    }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    const portalGrand = portalTotals.reduce((s, p) => s + p.total, 0);
    const maxPortal = Math.max(1, ...portalTotals.map((p) => p.total));

    // discrepancies
    const issues = list.reduce(
      (acc, r) => {
        const flagged =
          r.cashMismatch ||
          r.onlineSaleMismatch ||
          r.isMatchingFiskalne === "No" ||
          r.isMatchingING === "No";
        if (r.cashMismatch) acc.cash += 1;
        if (r.onlineSaleMismatch) acc.online += 1;
        if (r.isMatchingFiskalne === "No") acc.fiskalne += 1;
        if (r.isMatchingING === "No") acc.ing += 1;
        if (flagged) acc.flagged += 1;
        else acc.clean += 1;
        return acc;
      },
      { cash: 0, online: 0, fiskalne: 0, ing: 0, flagged: 0, clean: 0 },
    );

    return {
      days,
      maxDay,
      periodTotal,
      avgDay,
      peakDay,
      pay,
      payTotal,
      portalTotals,
      portalGrand,
      maxPortal,
      issues,
    };
  }, [reports, platforms]);

  if (!reports || reports.length === 0) return null;

  const {
    days,
    maxDay,
    periodTotal,
    avgDay,
    peakDay,
    pay,
    payTotal,
    portalTotals,
    portalGrand,
    maxPortal,
    issues,
  } = agg;
  const pct = (v) => (payTotal > 0 ? (v / payTotal) * 100 : 0);

  // Short day label from a YYYY-MM-DD string (the day-of-month).
  const dayLabel = (date) => (date || "").slice(8) || (date || "").slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
      {/* 1. Total sales by day */}
      <div className="bg-slate-50 rounded-xl p-5 lg:col-span-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
          <h3 className="text-slate-700 text-sm font-semibold uppercase tracking-wider">
            Total Sales by Day
          </h3>
          <div className="text-xs text-slate-500">
            Total{" "}
            <span className="text-sky-700 font-bold">{money(periodTotal)}</span>
            <span className="mx-1.5 text-slate-400">·</span>
            Avg/day <span className="text-slate-800 font-semibold">
              {money(avgDay)}
            </span>
            <span className="mx-1.5 text-slate-400">·</span>
            Peak{" "}
            <span className="text-slate-800 font-semibold">
              {money(peakDay.total)}
            </span>{" "}
            <span className="text-slate-400">({dayLabel(peakDay.date)})</span>
          </div>
        </div>

        {days.length === 1 ? (
          <p className="text-3xl font-bold text-sky-700">
            {money(days[0].total)}
            <span className="text-sm text-slate-500 font-medium ml-2">
              on {days[0].date}
            </span>
          </p>
        ) : (
          <div>
            {/* Bars row — fixed height so percentage heights resolve */}
            <div className="relative flex items-end gap-1 h-44">
              {/* Average reference line (90% scale leaves headroom for labels) */}
              <div
                className="absolute left-0 right-0 border-t border-dashed border-teal-200 z-10 pointer-events-none"
                style={{ bottom: `${(avgDay / maxDay) * 90}%` }}
              >
                <span className="absolute -top-4 right-0 text-[9px] text-teal-700/80 font-semibold">
                  avg {money(avgDay)}
                </span>
              </div>

              {days.map((d) => (
                <div
                  key={d.date}
                  className="flex-1 h-full flex flex-col justify-end items-center min-w-0"
                  title={`${d.date}: ${money(d.total)}`}
                >
                  {/* Value label above the bar (hidden when too many days) */}
                  {days.length <= 12 && d.total > 0 && (
                    <span className="text-[9px] text-slate-700 font-semibold mb-0.5 whitespace-nowrap">
                      {Math.round(d.total)}
                    </span>
                  )}
                  <div
                    className="w-full bg-sky-50 hover:bg-sky-400 rounded-t transition-colors"
                    style={{
                      height: `${Math.max(2, (d.total / maxDay) * 90)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            {/* Labels row, aligned to the bars above */}
            <div className="flex gap-1 mt-1">
              {days.map((d) => (
                <span
                  key={d.date}
                  className="flex-1 text-[9px] text-slate-400 truncate text-center min-w-0"
                >
                  {dayLabel(d.date)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Payment mix */}
      <div className="bg-slate-50 rounded-xl p-5">
        <h3 className="text-slate-700 text-sm font-semibold uppercase tracking-wider mb-4">
          Payment Mix
        </h3>
        <div className="space-y-3">
          {[
            { label: "Cash", value: pay.cash, bar: "bg-green-500" },
            { label: "Card", value: pay.card, bar: "bg-blue-500" },
            { label: "Online", value: pay.online, bar: "bg-emerald-500" },
          ]
            .sort((a, b) => b.value - a.value)
            .map((row) => (
            <div key={row.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">{row.label}</span>
                <span className="text-slate-800 font-semibold">
                  {money(row.value)} ({pct(row.value).toFixed(0)}%)
                </span>
              </div>
              <div className="h-2 bg-white rounded-full overflow-hidden">
                <div
                  className={`h-full ${row.bar} rounded-full`}
                  style={{ width: `${pct(row.value)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Portal-wise sales */}
      <div className="bg-slate-50 rounded-xl p-5 lg:col-span-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 mb-4">
          <h3 className="text-slate-700 text-sm font-semibold uppercase tracking-wider">
            Sales by Portal
          </h3>
          <span className="text-xs text-slate-500">
            Total{" "}
            <span className="text-emerald-700 font-bold">
              {money(portalGrand)}
            </span>
          </span>
        </div>
        {portalGrand === 0 ? (
          <p className="text-sm text-slate-400">
            No portal sales in this period.
          </p>
        ) : (
          <div className="space-y-3">
            {portalTotals.map((p) => (
              <div key={p.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-700 font-medium">{p.name}</span>
                  <span className="text-slate-800 font-semibold">
                    {money(p.total)}
                    <span className="text-slate-400 ml-1">
                      ({portalGrand > 0
                        ? ((p.total / portalGrand) * 100).toFixed(0)
                        : 0}
                      %)
                    </span>
                  </span>
                </div>
                <div className="h-2.5 bg-white rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${(p.total / maxPortal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Discrepancies */}
      <div className="bg-slate-50 rounded-xl p-5 lg:col-span-3">
        <h3 className="text-slate-700 text-sm font-semibold uppercase tracking-wider mb-4">
          Discrepancies ({issues.flagged} of {reports.length} reports flagged)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Balanced", value: issues.clean, text: "text-green-700" },
            { label: "Cash diff", value: issues.cash, text: "text-red-700" },
            { label: "Online diff", value: issues.online, text: "text-red-700" },
            { label: "Fiskalne No", value: issues.fiskalne, text: "text-red-700" },
            { label: "ING No", value: issues.ing, text: "text-red-700" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-slate-50 rounded-lg p-3 text-center"
            >
              <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default React.memo(AdminTrends);
