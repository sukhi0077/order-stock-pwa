// src/components/OrderItemRow.jsx
import React, { useState } from "react";
import { isOrdered, num, orderUnitOf } from "../models/OrderModel.js";
import { canEnterSubUnit, smallUnitOf, toSmall, fromSmall, SMALL_STEP } from "../utils/unitScale.js";
import { useT } from "../i18n/i18n.jsx";

// One item's order row: a −/＋ quantity stepper that auto-saves the order on
// change (no separate Add button). Once on the order, a note field appears.
// Teal theme.
function OrderItemRow({ item, line, onAdd, onRemove }) {
  const { t, ti } = useT();
  const on = isOrdered(line);
  const unit = orderUnitOf(item);

  // Sub-unit entry: kg items can be typed in grams so nobody has to enter
  // "0.1" on a phone keypad. The stored value stays in the base unit.
  const small = smallUnitOf(unit);
  const scalable = canEnterSubUnit(item);
  // Start in grams when the saved amount is already sub-kilo — that is the
  // unit the person last thought in.
  const [inSmall, setInSmall] = useState(
    () => scalable && on && num(line.qty) > 0 && num(line.qty) < 1,
  );

  // Seeded through the same conversion as the toggle, so the first render
  // already agrees with `inSmall` above.
  const [qty, setQty] = useState(() => {
    if (!on) return "";
    const base = num(line.qty);
    return String(scalable && base > 0 && base < 1 ? toSmall(base, unit) : base);
  });
  const [note, setNote] = useState(on ? line.note || "" : "");

  // Re-sync the inputs when the saved line changes. Adjusted during render
  // (React's alternative to a sync effect) so an auto-save does not repaint
  // the row a second time.
  //
  // What is tracked is the BASE quantity, deliberately not the displayed one:
  // if this keyed off the displayed value, flipping kg/g would look like the
  // line had changed and immediately overwrite what the toggle just converted.
  const savedBase = on ? num(line?.qty) : null;
  const savedNote = on ? line?.note || "" : "";
  const [seen, setSeen] = useState({ qty: savedBase, note: savedNote });
  if (seen.qty !== savedBase || seen.note !== savedNote) {
    setSeen({ qty: savedBase, note: savedNote });
    setQty(savedBase == null ? "" : String(inSmall ? toSmall(savedBase, unit) : savedBase));
    setNote(savedNote);
  }

  // `qty` is whatever the box shows — grams when the toggle is on. Everything
  // below converts to the BASE unit before persisting, so the database, the
  // stock counts and the history never see grams.
  const toBase = (shown) => (inSmall ? fromSmall(num(shown), unit) : num(shown));

  // Persist: qty > 0 saves the line, qty 0 removes it from the order.
  const commit = (shown, n) => {
    const base = toBase(shown);
    if (base > 0) onAdd(item.id, { qty: base, note: n });
    else onRemove(item.id);
  };
  const step = (delta) => {
    const size = inSmall ? SMALL_STEP : 1;
    const nq = Math.max(0, num(num(qty) + delta * size));
    setQty(nq ? String(nq) : "");
    commit(nq, note);
  };

  // Switching unit converts what is already typed rather than clearing it, so
  // tapping "g" on a 0.25 kg line shows 250 instead of losing the number.
  // Both setStates are plain calls — updating one inside the other's updater
  // would run twice under StrictMode and convert the value twice.
  const toggleUnit = () => {
    const next = !inSmall;
    const shown = num(qty);
    setInSmall(next);
    if (shown > 0) setQty(String(next ? toSmall(shown, unit) : fromSmall(shown, unit)));
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
          {/* Each half is a real tap target: this gets used mid-service with
              wet hands, so it is sized for a thumb rather than for the tiny
              unit caption it replaced. */}
          {scalable ? (
            <button
              type="button"
              onClick={toggleUnit}
              aria-label={`switch to ${inSmall ? unit : small}`}
              className="mt-1 inline-flex overflow-hidden rounded-lg border border-n-300 text-xs font-bold leading-none"
            >
              <span
                className={`min-w-[2.5rem] px-3 py-2 ${
                  !inSmall ? "bg-accent-600 text-white" : "text-n-500"
                }`}
              >
                {unit}
              </span>
              <span
                className={`min-w-[2.5rem] px-3 py-2 ${
                  inSmall ? "bg-accent-600 text-white" : "text-n-500"
                }`}
              >
                {small}
              </span>
            </button>
          ) : (
            <span className="text-[11px] text-n-400">{unit}</span>
          )}
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
            className={`h-10 w-16 text-center rounded-lg bg-n-0 border text-n-900 text-base outline-none focus:ring-2 focus:ring-accent-500 ${
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
