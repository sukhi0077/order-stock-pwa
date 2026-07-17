// src/components/StaffPanel.jsx
import React, { useMemo, useState } from "react";
import Spinner from "./ui/Spinner.jsx";
import CountNavigator from "./CountNavigator.jsx";
import { useItems } from "../hooks/useItems.js";
import { useStockCount } from "../hooks/useStockCount.js";
import { currentMonthId } from "../utils/monthUtils.js";
import { STATUS } from "../models/StockCountModel.js";
import { useT } from "../i18n/i18n.jsx";

export default function StaffPanel({ reporter, isOnline }) {
  const { t, tMonth } = useT();
  const monthId = currentMonthId();
  const [navKey, setNavKey] = useState(0);
  const itemsQuery = useItems();
  const activeItems = useMemo(
    () => (itemsQuery.data || []).filter((i) => i.active !== false),
    [itemsQuery.data],
  );

  const sc = useStockCount({ monthId, items: activeItems, reporter, isOnline });

  if (itemsQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label={t("loadingItems")} />
      </div>
    );
  }
  if (itemsQuery.isError) {
    return (
      <div className="text-center py-12 text-rose-600">
        {t("loadItemsErr")}{" "}
        <button onClick={() => itemsQuery.refetch()} className="underline">
          {t("retry")}
        </button>
      </div>
    );
  }
  if (activeItems.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">{t("noItemsStaff")}</div>
    );
  }

  const { summary, status, isFinalized } = sc;

  const handleSubmit = async () => {
    if (summary.counted === 0) return;
    if (!window.confirm(t("submitStockConfirm", { month: tMonth(monthId) }))) return;
    try {
      const res = await sc.submit();
      window.alert(res?.queued ? t("savedOffline") : t("stockSubmitted"));
      setNavKey((k) => k + 1);
    } catch {
      /* surfaced via sc.saveError */
    }
  };

  const statusPill = {
    [STATUS.DRAFT]: { text: t("status_draft"), cls: "bg-slate-100 text-slate-600" },
    [STATUS.SUBMITTED]: { text: t("status_submitted"), cls: "bg-amber-50 text-amber-700" },
    [STATUS.FINALIZED]: { text: t("status_finalized"), cls: "bg-emerald-50 text-emerald-700" },
  }[status];

  return (
    <div className="space-y-4 pb-24">
      {/* Slim month header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-tight">
            {tMonth(monthId)}
          </h2>
          <p className="text-xs text-slate-500">{t("endMonthCount")}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusPill.cls}`}>
          {statusPill.text}
        </span>
      </div>

      {sc.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner label={t("loadingMonth")} />
        </div>
      ) : (
        <>
          {isFinalized && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-2">
              {t("finalizedRO")}
            </div>
          )}

          {Object.keys(sc.prevClosing).length > 0 && !isFinalized && (
            <button
              onClick={sc.fillFromLastMonth}
              className="w-full py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-amber-700 hover:bg-amber-50"
            >
              {t("prefillLast")}
            </button>
          )}

          {sc.saveError && (
            <p className="text-rose-600 text-sm text-center">{sc.saveError}</p>
          )}

          <CountNavigator
            key={`${monthId}-${navKey}`}
            items={activeItems}
            counts={sc.counts}
            prevClosing={sc.prevClosing}
            onCommit={sc.commitCount}
            onSubmit={handleSubmit}
            disabled={isFinalized}
          />
        </>
      )}
    </div>
  );
}
