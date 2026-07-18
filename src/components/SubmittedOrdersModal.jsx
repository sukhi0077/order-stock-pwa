// src/components/SubmittedOrdersModal.jsx
import React, { useMemo, useState } from "react";
import Spinner from "./ui/Spinner.jsx";
import CategoryIcon from "./ui/CategoryIcon.jsx";
import { useOrders } from "../hooks/useOrders.js";
import { orderRef } from "../utils/exportCsv.js";
import { formatDateTime } from "../utils/monthUtils.js";
import { num, orderUnitOf } from "../models/OrderModel.js";
import { CATEGORY_ORDER, SUBCATEGORY_ORDER } from "../data/seedItems.js";
import { useT } from "../i18n/i18n.jsx";

function orderedKeys(keys, preferred) {
  const known = preferred.filter((k) => keys.includes(k));
  const extra = keys.filter((k) => !preferred.includes(k)).sort();
  return [...known, ...extra];
}

// Read-only view of a submitted order, grouped by category -> sub-category.
function OrderView({ order, itemsById, onBack }) {
  const { t, tc, ts, ti } = useT();

  const groups = useMemo(() => {
    const g = {};
    for (const [id, line] of Object.entries(order.lines || {})) {
      const it = itemsById[id] || {
        id,
        name: id,
        category: "Uncategorized",
        subCategory: "Other",
        unit: "",
      };
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

  const cats = orderedKeys(Object.keys(groups), CATEGORY_ORDER);
  const when = order.submittedAt || order.createdAt;

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
        <button onClick={onBack} className="h-8 w-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="back">
          ‹
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-900 truncate">{orderRef(order)}</div>
          <div className="text-[11px] text-slate-500">
            {when ? formatDateTime(new Date(when.seconds * 1000)) : ""}
          </div>
        </div>
      </div>
      <div className="overflow-y-auto px-4 py-3 space-y-3">
        {cats.map((cat) => (
          <div key={cat} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
              <span className="text-teal-600">
                <CategoryIcon name={cat} size={16} />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{tc(cat)}</span>
            </div>
            {orderedKeys(Object.keys(groups[cat]), SUBCATEGORY_ORDER[cat] || []).map((sub) => (
              <div key={sub}>
                <div className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-teal-600/80">
                  {ts(sub)}
                </div>
                <div className="divide-y divide-slate-100">
                  {groups[cat][sub].map(({ it, line }) => (
                    <div key={it.id} className="flex items-center gap-2 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 break-words">{ti(it.name, it)}</div>
                        {line.note && <div className="text-[11px] text-slate-400 truncate">{line.note}</div>}
                      </div>
                      <span className="text-sm font-semibold text-teal-700 shrink-0 whitespace-nowrap">
                        {num(line.qty)}{" "}
                        <span className="text-[11px] text-slate-400 font-normal">{orderUnitOf(it)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export default function SubmittedOrdersModal({ items, onClose }) {
  const { t } = useT();
  const ordersQuery = useOrders();
  const [openId, setOpenId] = useState(null);

  const itemsById = useMemo(
    () => Object.fromEntries((items || []).map((i) => [i.id, i])),
    [items],
  );
  const submitted = useMemo(
    () =>
      (ordersQuery.data || [])
        .filter((o) => o.status === "submitted")
        .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)),
    [ordersQuery.data],
  );
  const openOrder = submitted.find((o) => o.id === openId) || null;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/40 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div
        className="bg-white border border-slate-200 w-full md:max-w-2xl max-h-[90vh] rounded-t-2xl md:rounded-2xl flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {openOrder ? (
          <OrderView order={openOrder} itemsById={itemsById} onBack={() => setOpenId(null)} />
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900">{t("submittedOrders")}</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none px-2">
                ×
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3 space-y-2">
              {ordersQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : submitted.length === 0 ? (
                <p className="text-center text-slate-400 py-8">{t("noOrders")}</p>
              ) : (
                submitted.map((o) => {
                  const count = Object.keys(o.lines || {}).length;
                  const when = o.submittedAt || o.createdAt;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setOpenId(o.id)}
                      className="w-full text-left bg-white border border-slate-200 rounded-2xl p-3.5 hover:border-teal-300 hover:bg-teal-50/40 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{orderRef(o)}</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                          {t("status_submitted")}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <span>{t("nItems", { n: count })}</span>
                        <span>{when ? formatDateTime(new Date(when.seconds * 1000)) : ""}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
