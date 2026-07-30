// src/components/OrderItemRow.jsx
import React, { useState } from "react";
import { isOrdered, num, orderUnitOf } from "../models/OrderModel.js";
import { useT } from "../i18n/i18n.jsx";

// One item's order row: a −/＋ quantity stepper that auto-saves the order on
// change (no separate Add button). Once on the order, a note field appears.
// Teal theme.
function OrderItemRow({ item, line, onAdd, onRemove }) {
  const { t, ti } = useT();
  const on = isOrdered(line);
  const unit = orderUnitOf(item);

  const [qty, setQty] = useState(on ? String(num(line.qty)) : "");
  const [note, setNote] = useState(on ? line.note || "" : "");

  // Re-sync the inputs when the saved line changes. Adjusted during render
  // (React's alternative to a sync effect) so an auto-save does not repaint
  // the row a second time.
  const savedQty = on ? String(num(line?.qty)) : "";
  const savedNote = on ? line?.note || "" : "";
  const [seen, setSeen] = useState({ qty: savedQty, note: savedNote });
  if (seen.qty !== savedQty || seen.note !== savedNote) {
    setSeen({ qty: savedQty, note: savedNote });
    setQty(savedQty);
    setNote(savedNote);
  }

  // Persist: qty > 0 saves the line, qty 0 removes it from the order.
  const commit = (q, n) => {
    if (num(q) > 0) onAdd(item.id, { qty: num(q), note: n });
    else onRemove(item.id);
  };
  const step = (delta) => {
    const nq = Math.max(0, num(num(qty) + delta));
    setQty(nq ? String(nq) : "");
    commit(nq, note);
  };

  return (
    <div
      className={`rounded-xl border transition ${on ? "bg-accent-50/70 dark:bg-accent-900/20 border-accent-200 dark:border-accent-700/40" : "bg-n-0 border-n-200"}`}
    >
      <div className="flex items-center gap-3 py-2.5 pl-3 pr-2">
        <div className="min-w-0 flex-1">
          <div className="text-base font-medium text-n-800 leading-tight break-words">
            {ti(item.name, item)}
          </div>
          <span className="text-[11px] text-n-400">{unit}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => step(-1)}
            className="h-10 w-10 rounded-lg bg-n-100 border border-n-200 text-n-500 text-lg leading-none hover:bg-n-200"
            aria-label="decrease"
          >
            −
          </button>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={() => commit(qty, note)}
            placeholder="0"
            className={`h-10 w-14 text-center rounded-lg bg-n-0 border text-n-900 text-base outline-none focus:ring-2 focus:ring-accent-500 ${
              on ? "border-accent-400 font-semibold" : "border-n-300"
            }`}
          />
          <button
            type="button"
            onClick={() => step(1)}
            className="h-10 w-10 rounded-lg bg-n-100 border border-n-200 text-n-500 text-lg leading-none hover:bg-n-200"
            aria-label="increase"
          >
            +
          </button>
        </div>
      </div>

      {on && (
        <div className="px-3 pb-2.5">
          <input
            type="text"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => commit(qty, note)}
            placeholder={t("notePlaceholder")}
            className="w-full text-sm px-3 py-2 rounded-lg bg-n-0 border border-accent-200 dark:border-accent-700/40 text-n-700 outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>
      )}
    </div>
  );
}

export default React.memo(OrderItemRow);
