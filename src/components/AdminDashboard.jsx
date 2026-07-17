// src/components/AdminDashboard.jsx
import React, { useMemo, useState } from "react";
import Spinner from "./ui/Spinner.jsx";
import Icon from "./ui/Icon.jsx";
import CountNavigator from "./CountNavigator.jsx";
import MonthDetailsModal from "./MonthDetailsModal.jsx";
import ItemManagerModal from "./ItemManagerModal.jsx";
import OrdersAdmin from "./OrdersAdmin.jsx";
import ExpiryAdmin from "./ExpiryAdmin.jsx";
import { useItems, useSeedItems } from "../hooks/useItems.js";
import { useStockCount } from "../hooks/useStockCount.js";
import { StockCountService } from "../services/StockCountService.js";
import { useQueryClient } from "@tanstack/react-query";
import { currentMonthId, prevMonthId, nextMonthId } from "../utils/monthUtils.js";
import { STATUS } from "../models/StockCountModel.js";
import { downloadMonthCsv } from "../utils/exportCsv.js";
import { SEED_COUNT } from "../data/seedItems.js";
import { useT } from "../i18n/i18n.jsx";

export default function AdminDashboard({ reporter }) {
  const { t, tMonth } = useT();
  const qc = useQueryClient();
  const thisMonth = currentMonthId();
  const [tab, setTab] = useState("orders"); // 'stock' | 'orders'
  const [monthId, setMonthId] = useState(thisMonth);
  const [showDetails, setShowDetails] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [busyStatus, setBusyStatus] = useState(false);

  const itemsQuery = useItems();
  const seed = useSeedItems();
  const allItems = itemsQuery.data || [];
  const activeItems = useMemo(
    () => allItems.filter((i) => i.active !== false),
    [allItems],
  );

  const sc = useStockCount({ monthId, items: activeItems, reporter, isOnline: true });
  const canGoNext = monthId < thisMonth;

  const setStatus = async (status) => {
    setBusyStatus(true);
    try {
      await sc.setStatus(status);
      qc.invalidateQueries({ queryKey: ["stockMonth", monthId] });
    } catch {
      /* surfaced via saveError */
    } finally {
      setBusyStatus(false);
    }
  };

  const reopen = async () => {
    setBusyStatus(true);
    try {
      await StockCountService.setStatus(monthId, STATUS.SUBMITTED);
      qc.invalidateQueries({ queryKey: ["stockMonth", monthId] });
    } finally {
      setBusyStatus(false);
    }
  };

  if (itemsQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label={t("loadingItemsShort")} />
      </div>
    );
  }

  // First-run: no items yet — offer to seed the 260-item master list.
  if (allItems.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4 space-y-4">
        <h2 className="text-xl font-bold text-slate-900">{t("setupItems_title")}</h2>
        <p className="text-slate-500 text-sm">{t("setupItems_desc", { n: SEED_COUNT })}</p>
        {seed.isError && (
          <p className="text-rose-600 text-sm">
            {seed.error?.message || t("seedFailed")}
          </p>
        )}
        <button
          onClick={() => seed.mutate()}
          disabled={seed.isPending}
          className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold disabled:opacity-50"
        >
          {seed.isPending ? t("loadingItems") : t("load260", { n: SEED_COUNT })}
        </button>
      </div>
    );
  }

  // Manage items is a full page (not a modal).
  if (showItems) {
    return <ItemManagerModal items={allItems} onBack={() => setShowItems(false)} />;
  }

  const { summary, status, isFinalized } = sc;
  const pct = summary.totalItems
    ? Math.round((summary.counted / summary.totalItems) * 100)
    : 0;

  const statusPill = {
    [STATUS.DRAFT]: { text: t("status_draft"), cls: "bg-slate-100 text-slate-600" },
    [STATUS.SUBMITTED]: { text: t("status_submitted"), cls: "bg-amber-50 text-amber-700" },
    [STATUS.FINALIZED]: { text: t("status_finalized"), cls: "bg-emerald-50 text-emerald-700" },
  }[status];

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t("dashboard")}</h1>
        <button
          onClick={() => setShowItems(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <Icon name="sliders" size={15} />
          {t("manageItems")}
        </button>
      </div>

      {/* Orders / Stock / Expiry tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {[
          { id: "orders", icon: "cart", label: t("tab_orders") },
          { id: "stock", icon: "stock", label: t("tab_stock") },
          { id: "expiry", icon: "calendar", label: t("tab_expiry") },
        ].map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition ${
              tab === tb.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon name={tb.icon} size={15} />
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "orders" ? (
        <OrdersAdmin reporter={reporter} />
      ) : tab === "expiry" ? (
        <ExpiryAdmin />
      ) : (
        <>
      {/* Month navigator + progress */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMonthId(prevMonthId(monthId))}
            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-slate-100 text-slate-600 font-bold text-lg"
          >
            ‹
          </button>
          <div className="text-center">
            <div className="font-bold text-slate-900">{tMonth(monthId)}</div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusPill.cls}`}>
              {statusPill.text}
            </span>
          </div>
          <button
            onClick={() => canGoNext && setMonthId(nextMonthId(monthId))}
            disabled={!canGoNext}
            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-slate-100 text-slate-600 font-bold text-lg disabled:opacity-30"
          >
            ›
          </button>
        </div>

        {!sc.isLoading && (
          <div className="mt-3">
            <div className="flex items-end justify-between mb-1">
              <span className="text-2xl font-bold text-slate-900 leading-none">
                {summary.counted}
                <span className="text-sm font-medium text-slate-400"> / {summary.totalItems}</span>
              </span>
              <span className="text-sm font-semibold text-amber-600">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {sc.isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner label={t("loadingMonth")} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowDetails(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:text-slate-900"
            >
              <Icon name="eye" size={16} />
              {t("viewDetails")}
            </button>
            <button
              onClick={() => downloadMonthCsv(monthId, activeItems, sc.counts)}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:text-slate-900"
            >
              <Icon name="download" size={16} />
              {t("exportCsv")}
            </button>
            {!isFinalized ? (
              <button
                onClick={() => {
                  if (window.confirm(t("finalizeConfirm", { month: tMonth(monthId) })))
                    setStatus(STATUS.FINALIZED);
                }}
                disabled={sc.saving || busyStatus}
                className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white disabled:opacity-50"
              >
                <Icon name="check" size={16} />
                {t("finalizeMonth")}
              </button>
            ) : (
              <button
                onClick={reopen}
                disabled={busyStatus}
                className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-sm font-bold text-white disabled:opacity-50"
              >
                <Icon name="refresh" size={16} />
                {busyStatus ? t("reopening") : t("reopenMonth")}
              </button>
            )}
          </div>

          {sc.saveError && (
            <p className="text-rose-600 text-sm text-center">{sc.saveError}</p>
          )}

          {Object.keys(sc.prevClosing).length > 0 && !isFinalized && (
            <button
              onClick={sc.fillFromLastMonth}
              className="w-full py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-amber-700 hover:bg-amber-50"
            >
              {t("prefillLast")}
            </button>
          )}

          <CountNavigator
            key={monthId}
            items={activeItems}
            counts={sc.counts}
            prevClosing={sc.prevClosing}
            onCommit={sc.commitCount}
            disabled={isFinalized}
          />
        </>
      )}
        </>
      )}

      {showDetails && (
        <MonthDetailsModal
          monthId={monthId}
          items={activeItems}
          counts={sc.counts}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  );
}
