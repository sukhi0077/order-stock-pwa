// src/components/OrderPanel.jsx
import React, { useMemo, useState } from "react";
import Spinner from "./ui/Spinner.jsx";
import OrderNavigator from "./OrderNavigator.jsx";
import SubmittedOrdersModal from "./SubmittedOrdersModal.jsx";
import { useItems } from "../hooks/useItems.js";
import { useOrder } from "../hooks/useOrder.js";
import { useT } from "../i18n/i18n.jsx";

export default function OrderPanel({ reporter }) {
  const { t } = useT();
  const itemsQuery = useItems();
  const activeItems = useMemo(
    () => (itemsQuery.data || []).filter((i) => i.active !== false),
    [itemsQuery.data],
  );

  const oc = useOrder({ items: activeItems, reporter });
  // Remount the navigator (back to the dashboard) after submitting.
  const [navKey, setNavKey] = useState(0);
  const [showSubmitted, setShowSubmitted] = useState(false);

  if (itemsQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label={t("loadingItems")} />
      </div>
    );
  }
  if (activeItems.length === 0) {
    return <div className="text-center py-12 text-slate-500">{t("noItemsStaff")}</div>;
  }

  const handleSubmit = async () => {
    if (oc.summary.onOrder === 0) {
      window.alert(t("addOneItem"));
      return;
    }
    if (!window.confirm(t("submitOrderConfirm", { n: oc.summary.onOrder }))) return;
    try {
      await oc.submit();
      window.alert(t("orderSent"));
      setNavKey((k) => k + 1);
    } catch {
      /* surfaced via saveError */
    }
  };

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900 leading-tight">{t("placeOrder")}</h2>
          <p className="text-xs text-slate-500 truncate">{t("placeOrder_desc")}</p>
        </div>
        <button
          onClick={() => setShowSubmitted(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 6h13" />
            <path d="M8 12h13" />
            <path d="M8 18h13" />
            <path d="M3 6h.01" />
            <path d="M3 12h.01" />
            <path d="M3 18h.01" />
          </svg>
          {t("submittedOrders")}
        </button>
      </div>

      {oc.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner label={t("loadingOrder")} />
        </div>
      ) : (
        <>
          {oc.saveError && (
            <p className="text-rose-600 text-sm text-center">{oc.saveError}</p>
          )}
          <OrderNavigator
            key={navKey}
            items={activeItems}
            lines={oc.lines}
            onAdd={oc.addLine}
            onRemove={oc.removeLine}
            onSubmit={handleSubmit}
            busy={oc.saving}
          />
        </>
      )}

      {showSubmitted && (
        <SubmittedOrdersModal items={activeItems} onClose={() => setShowSubmitted(false)} />
      )}
    </div>
  );
}
