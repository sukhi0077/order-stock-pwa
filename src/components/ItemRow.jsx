// src/components/ItemRow.jsx
import React, { useEffect, useState } from "react";
import { isCounted, num } from "../models/StockCountModel.js";
import { useT } from "../i18n/i18n.jsx";

// One item's closing-count row (amber theme). A −/＋ stepper that AUTO-SAVES the
// month on change (no separate save). Tap "last: X" to use last month's closing.
function ItemRow({ item, value, prev, disabled, onCommit }) {
  const { t, ti } = useT();
  const [val, setVal] = useState(value ?? "");
  useEffect(() => setVal(value ?? ""), [value]);

  const counted = isCounted(val);
  const hasPrev = prev !== undefined && prev !== null && prev !== "";

  const commit = (v) => onCommit(item.id, v);
  const step = (delta) => {
    const base = counted ? num(val) : hasPrev ? num(prev) : 0;
    const next = Math.max(0, num(base + delta));
    setVal(String(next));
    commit(String(next));
  };

  return (
    <div
      className={`flex items-center gap-3 py-2.5 pl-3 pr-2 rounded-xl border transition ${
        counted ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {counted && (
            <span className="text-amber-600 text-xs shrink-0" aria-hidden>
              ✓
            </span>
          )}
          <span className="text-base font-medium text-slate-800 leading-tight break-words min-w-0">
            {ti(item.name, item)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[11px] text-slate-400">{item.unit}</span>
          {hasPrev && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setVal(String(num(prev)));
                commit(String(num(prev)));
              }}
              className="text-[11px] text-amber-600 hover:text-amber-700 disabled:opacity-40"
              title="Tap to use last month's closing"
            >
              {t("last", { v: num(prev) })}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          disabled={disabled}
          onClick={() => step(-1)}
          className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-lg leading-none hover:bg-slate-200 disabled:opacity-40"
          aria-label="decrease"
        >
          −
        </button>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          disabled={disabled}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => commit(val)}
          placeholder="—"
          className={`h-9 w-16 text-center rounded-lg bg-white border text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 transition ${
            counted ? "border-amber-400 font-semibold" : "border-slate-300"
          }`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => step(1)}
          className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-lg leading-none hover:bg-slate-200 disabled:opacity-40"
          aria-label="increase"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default React.memo(ItemRow);
