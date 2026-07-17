// src/components/OrderItemRow.jsx
import React, { useEffect, useState } from "react";
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

  useEffect(() => {
    setQty(on ? String(num(line?.qty)) : "");
    setNote(on ? line?.note || "" : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line?.qty, line?.note]);

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
      className={`rounded-xl border transition ${on ? "bg-teal-50/70 border-teal-200" : "bg-white border-slate-200"}`}
    >
      <div className="flex items-center gap-3 py-2.5 pl-3 pr-2">
        <div className="min-w-0 flex-1">
          <div className="text-base font-medium text-slate-800 leading-tight truncate">
            {ti(item.name, item)}
          </div>
          <span className="text-[11px] text-slate-400">{unit}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => step(-1)}
            className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-lg leading-none hover:bg-slate-200"
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
            className={`h-10 w-14 text-center rounded-lg bg-white border text-slate-900 text-base outline-none focus:ring-2 focus:ring-teal-500 ${
              on ? "border-teal-400 font-semibold" : "border-slate-300"
            }`}
          />
          <button
            type="button"
            onClick={() => step(1)}
            className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-lg leading-none hover:bg-slate-200"
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
            className="w-full text-sm px-3 py-2 rounded-lg bg-white border border-teal-200 text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      )}
    </div>
  );
}

export default React.memo(OrderItemRow);
