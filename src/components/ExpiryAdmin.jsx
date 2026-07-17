// src/components/ExpiryAdmin.jsx
import React, { useMemo, useState } from "react";
import Spinner from "./ui/Spinner.jsx";
import CategoryIcon from "./ui/CategoryIcon.jsx";
import { useItems } from "../hooks/useItems.js";
import { useReceipts, useDeleteReceipt } from "../hooks/useReceipts.js";
import { inWindow, WINDOWS, num, daysLeft } from "../models/ReceiptModel.js";
import { formatDay } from "../utils/monthUtils.js";
import { useT } from "../i18n/i18n.jsx";

function ExpiryBadge({ expiry }) {
  const { t } = useT();
  const d = daysLeft(expiry);
  if (d === null) return null;
  let cls = "bg-slate-100 text-slate-500";
  let text;
  if (d < 0) {
    cls = "bg-rose-100 text-rose-700";
    text = t("expiredAgo", { n: Math.abs(d) });
  } else if (d === 0) {
    cls = "bg-rose-100 text-rose-700";
    text = t("expiresToday");
  } else {
    text = t("daysLeft", { n: d });
    if (d <= 7) cls = "bg-rose-100 text-rose-700";
    else if (d <= 30) cls = "bg-amber-100 text-amber-700";
  }
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{text}</span>;
}

export default function ExpiryAdmin() {
  const { t, ti } = useT();
  const itemsQuery = useItems();
  const receiptsQuery = useReceipts();
  const delReceipt = useDeleteReceipt();
  const [win, setWin] = useState("thisMonth");

  const itemsById = useMemo(
    () => Object.fromEntries((itemsQuery.data || []).map((i) => [i.id, i])),
    [itemsQuery.data],
  );
  const nameOf = (r) => {
    const it = itemsById[r.itemId];
    return it ? ti(it.name, it) : ti(r.itemName);
  };

  // Batches in the selected window, grouped by item, soonest expiry first.
  const groups = useMemo(() => {
    const inWin = (receiptsQuery.data || []).filter((r) => inWindow(r.expiry, win));
    inWin.sort((a, b) => String(a.expiry).localeCompare(String(b.expiry)));
    const byItem = new Map();
    for (const r of inWin) {
      if (!byItem.has(r.itemId)) byItem.set(r.itemId, { itemId: r.itemId, batches: [], total: 0, unit: r.unit });
      const g = byItem.get(r.itemId);
      g.batches.push(r);
      g.total += num(r.qty);
    }
    return [...byItem.values()];
  }, [receiptsQuery.data, win]);

  const totalBatches = groups.reduce((n, g) => n + g.batches.length, 0);

  return (
    <div className="space-y-3">
      {/* Window filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {WINDOWS.map((w) => (
          <button
            key={w}
            onClick={() => setWin(w)}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border ${
              win === w
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white border-slate-200 text-slate-600"
            }`}
          >
            {t(
              w === "expired"
                ? "win_expired"
                : w === "thisMonth"
                  ? "win_thisMonth"
                  : w === "next30"
                    ? "win_next30"
                    : w === "nextMonth"
                      ? "win_nextMonth"
                      : "win_next2Months",
            )}
          </button>
        ))}
      </div>

      {itemsQuery.isLoading || receiptsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : totalBatches === 0 ? (
        <p className="text-slate-400 text-sm py-10 text-center">{t("noExpiring")}</p>
      ) : (
        <div className="space-y-2.5">
          {groups.map((g) => {
            const item = itemsById[g.itemId];
            const cat = item?.category;
            return (
              <div key={g.itemId} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
                  <span className="text-indigo-600 shrink-0">
                    <CategoryIcon name={cat} size={18} />
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-bold text-slate-900 truncate">
                    {nameOf(g.batches[0])}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 shrink-0">
                    {t("totalQty", { qty: g.total, unit: g.unit })}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {g.batches.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="text-sm text-slate-700 w-16 shrink-0">
                        {num(r.qty)} {r.unit}
                      </span>
                      <span className="flex-1 text-xs text-slate-500">
                        {t("expires")} {formatDay(r.expiry)}
                      </span>
                      <ExpiryBadge expiry={r.expiry} />
                      <button
                        onClick={() => {
                          if (window.confirm(t("removeReceipt"))) delReceipt.mutate(r.id);
                        }}
                        className="h-6 w-6 grid place-items-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 leading-none"
                        aria-label="remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
