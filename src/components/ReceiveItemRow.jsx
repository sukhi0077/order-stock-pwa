// src/components/ReceiveItemRow.jsx
import React, { useState } from "react";
import ExpiryBadge from "./ui/ExpiryBadge.jsx";
import { num, isValidDate } from "../models/ReceiptModel.js";
import { formatDay } from "../utils/monthUtils.js";
import { useT } from "../i18n/i18n.jsx";

// One item in the receive drill-down: add a batch (qty + expiry) and see this
// item's existing batches.
//
// `ordered` is optional: when the row is shown while receiving against a
// submitted order it carries { qty, unit, note } from that order, so staff can
// see what was asked for next to what they are logging.
function ReceiveItemRow({ item, batches, onAdd, onDelete, adding, ordered = null }) {
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
    <div className={`rounded-xl border p-3 ${has ? "bg-accent-50/60 border-accent-200" : "bg-n-0 border-n-200"}`}>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-base font-medium text-n-800 leading-tight break-words min-w-0">
          {ti(item.name, item)}
        </span>
        <span className="text-[11px] text-n-400 shrink-0">{item.unit}</span>
      </div>

      {ordered && (
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded-md bg-accent-100 px-1.5 py-0.5 text-[11px] font-semibold text-accent-800">
            {t("orderedQty", { qty: ordered.qty, unit: ordered.unit })}
          </span>
          {ordered.note && (
            <span className="min-w-0 flex-1 truncate text-[11px] text-n-500">
              {ordered.note}
            </span>
          )}
        </div>
      )}

      {/* Grid, not flex: a native date input has a wide minimum intrinsic size
          that ignores flex shrinking, so on a narrow phone it used to push the
          Add button off the row and overlap it. Below `sm` the button gets its
          own full-width line; from `sm` up all three sit side by side. */}
      <div className="grid grid-cols-[4rem_minmax(0,1fr)] sm:grid-cols-[4rem_minmax(0,1fr)_auto] gap-2 items-end">
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[10px] uppercase tracking-wide text-n-400">{t("quantity")}</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="h-10 w-full text-center rounded-lg bg-n-0 border border-n-300 text-n-900 text-base outline-none focus:ring-2 focus:ring-accent-500"
          />
        </label>
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[10px] uppercase tracking-wide text-n-400">{t("expiryDate")}</span>
          {/* min-w-0 belt-and-braces: the grid track above already caps this
              input, but the intrinsic width of a native date input is wide
              enough that it is worth pinning in both places. */}
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="h-10 w-full min-w-0 rounded-lg bg-n-0 border border-n-300 text-n-900 text-base px-2 outline-none focus:ring-2 focus:ring-accent-500"
          />
        </label>
        <button
          type="button"
          onClick={add}
          disabled={!valid || adding}
          className="col-span-2 sm:col-span-1 h-10 px-4 rounded-lg bg-accent-500 hover:bg-accent-400 text-white font-bold text-sm disabled:opacity-40"
        >
          {t("addBatch")}
        </button>
      </div>

      {has && (
        <div className="mt-2 space-y-1">
          {batches.map((b) => (
            <div key={b.id} className="flex items-center gap-2 text-xs">
              <span className="text-n-700 w-16 shrink-0">
                {num(b.qty)} {b.unit}
              </span>
              <span className="flex-1 text-n-500 truncate">
                {t("expires")} {formatDay(b.expiry)}
              </span>
              <ExpiryBadge expiry={b.expiry} />
              <button
                onClick={() => {
                  if (window.confirm(t("removeReceipt"))) onDelete(b.id);
                }}
                className="h-6 w-6 grid place-items-center rounded-lg text-n-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 shrink-0 leading-none"
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
