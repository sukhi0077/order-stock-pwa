// src/components/ReceiveItemRow.jsx
import React, { useState } from "react";
import ExpiryBadge from "./ui/ExpiryBadge.jsx";
import { num, isValidDate } from "../models/ReceiptModel.js";
import { formatDay } from "../utils/monthUtils.js";
import { useT } from "../i18n/i18n.jsx";

// One item in the receive drill-down: add a batch (qty + expiry) and see this
// item's existing batches. Amber theme.
function ReceiveItemRow({ item, batches, onAdd, onDelete, adding }) {
  const { t, ti } = useT();
  const [qty, setQty] = useState("");
  const [expiry, setExpiry] = useState("");
  const valid = num(qty) > 0 && isValidDate(expiry);

  const add = async () => {
    if (!valid) return;
    await onAdd(item, qty, expiry);
    setQty("");
    setExpiry("");
  };

  const has = batches && batches.length > 0;

  return (
    <div className={`rounded-xl border p-3 ${has ? "bg-blue-50/60 border-blue-200" : "bg-white border-slate-200"}`}>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-base font-medium text-slate-800 leading-tight break-words min-w-0">
          {ti(item.name, item)}
        </span>
        <span className="text-[11px] text-slate-400 shrink-0">{item.unit}</span>
      </div>

      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 w-16 shrink-0">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">{t("quantity")}</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="h-10 text-center rounded-lg bg-white border border-slate-300 text-slate-900 text-base outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">{t("expiryDate")}</span>
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="h-10 w-full rounded-lg bg-white border border-slate-300 text-slate-900 text-base px-2 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <button
          type="button"
          onClick={add}
          disabled={!valid || adding}
          className="h-10 px-3 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm disabled:opacity-40 shrink-0"
        >
          {t("addBatch")}
        </button>
      </div>

      {has && (
        <div className="mt-2 space-y-1">
          {batches.map((b) => (
            <div key={b.id} className="flex items-center gap-2 text-xs">
              <span className="text-slate-700 w-16 shrink-0">
                {num(b.qty)} {b.unit}
              </span>
              <span className="flex-1 text-slate-500 truncate">
                {t("expires")} {formatDay(b.expiry)}
              </span>
              <ExpiryBadge expiry={b.expiry} />
              <button
                onClick={() => {
                  if (window.confirm(t("removeReceipt"))) onDelete(b.id);
                }}
                className="h-6 w-6 grid place-items-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 leading-none"
                aria-label="remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(ReceiveItemRow);
