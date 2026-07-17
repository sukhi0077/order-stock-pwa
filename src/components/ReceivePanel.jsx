// src/components/ReceivePanel.jsx
import React, { useMemo } from "react";
import Spinner from "./ui/Spinner.jsx";
import ReceiveNavigator from "./ReceiveNavigator.jsx";
import { useItems } from "../hooks/useItems.js";
import { useReceipts, useAddReceipt, useDeleteReceipt } from "../hooks/useReceipts.js";
import { useT } from "../i18n/i18n.jsx";

export default function ReceivePanel({ reporter }) {
  const { t } = useT();
  const itemsQuery = useItems();
  const receiptsQuery = useReceipts();
  const addReceipt = useAddReceipt();
  const delReceipt = useDeleteReceipt();

  const activeItems = useMemo(
    () => (itemsQuery.data || []).filter((i) => i.active !== false),
    [itemsQuery.data],
  );

  const handleAdd = (item, qty, expiry) =>
    addReceipt.mutateAsync({ item, qty, expiry, reporter });
  const handleDelete = (id) => delReceipt.mutate(id);

  if (itemsQuery.isLoading || receiptsQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label={t("loadingItems")} />
      </div>
    );
  }
  if (activeItems.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">{t("noItemsStaff")}</div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center gap-2">
        <span className="h-9 w-9 grid place-items-center rounded-xl bg-blue-500 text-white shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16v6H4z" />
            <path d="M4 10v10h16V10" />
            <path d="M9 14h6" />
          </svg>
        </span>
        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-tight">{t("receive")}</h2>
          <p className="text-xs text-slate-500">{t("receive_desc")}</p>
        </div>
      </div>

      <ReceiveNavigator
        items={activeItems}
        receipts={receiptsQuery.data || []}
        onAdd={handleAdd}
        onDelete={handleDelete}
        adding={addReceipt.isPending}
      />
    </div>
  );
}
