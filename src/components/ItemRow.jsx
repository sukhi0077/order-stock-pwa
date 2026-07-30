// src/components/ItemRow.jsx
import React, { useState } from "react";
import { isCounted, num } from "../models/StockCountModel.js";
import { useT } from "../i18n/i18n.jsx";

// One item's closing-count row (amber theme). A −/＋ stepper that AUTO-SAVES the
// month on change (no separate save). Tap "last: X" to use last month's closing.
function ItemRow({ item, value, prev, disabled, onCommit }) {
  const { t, ti } = useT();
  // Mirror the saved value locally so typing is smooth, re-syncing when a new
  // value arrives. Adjusted during render rather than in an effect: an effect
  // would repaint the row twice on every save round-trip.
  const [val, setVal] = useState(value ?? "");
  const [seen, setSeen] = useState(value ?? "");
  if ((value ?? "") !== seen) {
    setSeen(value ?? "");
    setVal(value ?? "");
  }

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
        counted ? "bg-accent-50 border-accent-200" : "bg-n-0 border-n-200"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {counted && (
            <span className="text-accent-600 text-xs shrink-0" aria-hidden>
              ✓
            </span>
          )}
          <span className="text-base font-medium text-n-800 leading-tight break-words min-w-0">
            {ti(item.name, item)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[11px] text-n-400">{item.unit}</span>
          {hasPrev && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setVal(String(num(prev)));
                commit(String(num(prev)));
              }}
              className="text-[11px] text-accent-600 hover:text-accent-700 disabled:opacity-40"
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
          className="h-9 w-9 rounded-lg bg-n-100 border border-n-200 text-n-500 text-lg leading-none hover:bg-n-200 disabled:opacity-40"
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
          className={`h-9 w-16 text-center rounded-lg bg-n-0 border text-n-900 outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 transition ${
            counted ? "border-accent-400 font-semibold" : "border-n-300"
          }`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => step(1)}
          className="h-9 w-9 rounded-lg bg-n-100 border border-n-200 text-n-500 text-lg leading-none hover:bg-n-200 disabled:opacity-40"
          aria-label="increase"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default React.memo(ItemRow);
