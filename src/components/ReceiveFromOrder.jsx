// src/components/ReceiveFromOrder.jsx
//
// Receive against a SUBMITTED order: staff pick one of the orders that went to
// the admin, then log batches straight off that order's item list instead of
// hunting for each item through the category drill-down.
//
// This is a READ of the order only. Logging a receipt writes a receipt row; the
// order itself is never modified, so an order stays exactly as submitted no
// matter how much of it has arrived.
import React, { useMemo, useState } from "react";
import Spinner from "./ui/Spinner.jsx";
import ReceiveItemRow from "./ReceiveItemRow.jsx";
import { useOrders } from "../hooks/useOrders.js";
import { orderRef } from "../utils/exportCsv.js";
import { formatDateTime } from "../utils/monthUtils.js";
import { num as orderNum, orderUnitOf, STATUS } from "../models/OrderModel.js";
import { CATEGORY_ORDER, SUBCATEGORY_ORDER } from "../data/seedItems.js";
import { useT } from "../i18n/i18n.jsx";

function orderedKeys(keys, preferred) {
  const known = preferred.filter((k) => keys.includes(k));
  const extra = keys.filter((k) => !preferred.includes(k)).sort();
  return [...known, ...extra];
}

// A quick category / sub-category filter chip. `small` is the sub-category
// variant, one step down in weight so the two rows read as a hierarchy.
function FilterChip({ active, onClick, small = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border transition ${
        small ? "text-[11px] px-2.5 py-1" : "text-xs font-semibold px-3 py-1.5"
      } ${
        active
          ? "bg-blue-500 border-blue-500 text-white"
          : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
      }`}
    >
      {children}
    </button>
  );
}

// One submitted order's items, grouped category -> sub-category, each with the
// normal receive controls.
function OrderReceiveView({ order, items, batchesByItem, onAdd, onDelete, adding, onBack }) {
  const { t, tc, ts } = useT();
  const itemsById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  // Only lines that are actually on the order, and only items still active in
  // this app — a deactivated item can't take a receipt.
  const groups = useMemo(() => {
    const g = {};
    for (const [id, line] of Object.entries(order.lines || {})) {
      const it = itemsById[id];
      if (!it) continue;
      const c = it.category || "Uncategorized";
      const s = it.subCategory || "Other";
      g[c] = g[c] || {};
      (g[c][s] = g[c][s] || []).push({ it, line });
    }
    for (const c of Object.keys(g))
      for (const s of Object.keys(g[c]))
        g[c][s].sort((a, b) => (a.it.sortOrder ?? 0) - (b.it.sortOrder ?? 0));
    return g;
  }, [order, itemsById]);

  const allCats = orderedKeys(Object.keys(groups), CATEGORY_ORDER);

  // Quick filters. A delivery usually arrives in crates of one kind, so being
  // able to narrow to "Veg" (and then "Root") beats scrolling the whole order.
  // null = no filter. Picking a category clears any sub-category from the
  // previous one, which would otherwise silently hide everything.
  const [filterCat, setFilterCat] = useState(null);
  const [filterSub, setFilterSub] = useState(null);
  const activeCat = filterCat && groups[filterCat] ? filterCat : null;
  const subsForCat = activeCat
    ? orderedKeys(Object.keys(groups[activeCat]), SUBCATEGORY_ORDER[activeCat] || [])
    : [];
  const activeSub = activeCat && filterSub && groups[activeCat][filterSub] ? filterSub : null;

  const cats = activeCat ? [activeCat] : allCats;
  const subsOf = (cat) => {
    const list = orderedKeys(Object.keys(groups[cat]), SUBCATEGORY_ORDER[cat] || []);
    return cat === activeCat && activeSub ? [activeSub] : list;
  };

  const lineCount = Object.keys(order.lines || {}).length;
  // How many of the order's items already have at least one batch logged. A
  // rough "how far along am I" signal, not an exact quantity reconciliation.
  const doneCount = useMemo(
    () =>
      Object.keys(order.lines || {}).filter((id) => (batchesByItem[id] || []).length > 0).length,
    [order, batchesByItem],
  );
  const when = order.submittedAt || order.createdAt;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="h-9 w-9 grid place-items-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 shrink-0"
          aria-label="back"
        >
          ‹
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-slate-900 truncate">{orderRef(order)}</div>
          <div className="text-[11px] text-slate-500">
            {t("receivedOfOrdered", { done: doneCount, total: lineCount })}
            {when ? ` · ${formatDateTime(new Date(when.seconds * 1000))}` : ""}
          </div>
        </div>
      </div>

      {allCats.length === 0 && (
        <p className="text-center text-slate-400 py-8">{t("noReceivableItems")}</p>
      )}

      {allCats.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            <FilterChip
              active={!activeCat}
              onClick={() => {
                setFilterCat(null);
                setFilterSub(null);
              }}
            >
              {t("all")}
            </FilterChip>
            {allCats.map((c) => (
              <FilterChip
                key={c}
                active={activeCat === c}
                onClick={() => {
                  setFilterCat(c);
                  setFilterSub(null);
                }}
              >
                {tc(c)}
              </FilterChip>
            ))}
          </div>

          {subsForCat.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              <FilterChip active={!activeSub} onClick={() => setFilterSub(null)} small>
                {t("all")}
              </FilterChip>
              {subsForCat.map((s) => (
                <FilterChip
                  key={s}
                  active={activeSub === s}
                  onClick={() => setFilterSub(s)}
                  small
                >
                  {ts(s)}
                </FilterChip>
              ))}
            </div>
          )}
        </div>
      )}

      {cats.map((cat) => (
        <div key={cat} className="space-y-1.5">
          {subsOf(cat).map((sub) => (
            <div key={sub} className="space-y-1.5">
              <h3 className="px-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {tc(cat)} · {ts(sub)}
              </h3>
              {groups[cat][sub].map(({ it, line }) => (
                <ReceiveItemRow
                  key={it.id}
                  item={it}
                  batches={batchesByItem[it.id] || []}
                  onAdd={onAdd}
                  onDelete={onDelete}
                  adding={adding}
                  ordered={{
                    qty: orderNum(line.qty),
                    unit: orderUnitOf(it),
                    note: line.note || "",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// The picker + the per-order view.
export default function ReceiveFromOrder({ items, batchesByItem, onAdd, onDelete, adding }) {
  const { t } = useT();
  const ordersQuery = useOrders();
  const [openId, setOpenId] = useState(null);

  // Drafts are still being built up by staff, so only submitted orders can be
  // received against. Newest first — that is the delivery most likely arriving.
  const submitted = useMemo(
    () =>
      (ordersQuery.data || [])
        .filter((o) => o.status === STATUS.SUBMITTED)
        .sort(
          (a, b) =>
            (b.submittedAt?.seconds || b.createdAt?.seconds || 0) -
            (a.submittedAt?.seconds || a.createdAt?.seconds || 0),
        ),
    [ordersQuery.data],
  );

  if (ordersQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner label={t("loadingOrders")} />
      </div>
    );
  }

  const open = submitted.find((o) => o.id === openId);
  if (open) {
    return (
      <OrderReceiveView
        order={open}
        items={items}
        batchesByItem={batchesByItem}
        onAdd={onAdd}
        onDelete={onDelete}
        adding={adding}
        onBack={() => setOpenId(null)}
      />
    );
  }

  if (submitted.length === 0) {
    return <p className="text-center text-slate-400 py-8">{t("noSubmittedOrders")}</p>;
  }

  return (
    <div className="space-y-2">
      {submitted.map((o) => {
        const ids = Object.keys(o.lines || {});
        const done = ids.filter((id) => (batchesByItem[id] || []).length > 0).length;
        const when = o.submittedAt || o.createdAt;
        const complete = ids.length > 0 && done === ids.length;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => setOpenId(o.id)}
            className="w-full text-left bg-white border border-slate-200 rounded-2xl p-3.5 hover:border-blue-300 hover:bg-blue-50/40 transition"
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 min-w-0 font-semibold text-slate-900 truncate">
                {orderRef(o)}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  complete ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"
                }`}
              >
                {t("receivedOfOrdered", { done, total: ids.length })}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {when ? formatDateTime(new Date(when.seconds * 1000)) : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}
