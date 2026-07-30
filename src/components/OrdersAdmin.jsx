// src/components/OrdersAdmin.jsx
import React, { useMemo, useState } from "react";
import Spinner from "./ui/Spinner.jsx";
import OrderNavigator from "./OrderNavigator.jsx";
import { useItems } from "../hooks/useItems.js";
import { useOrders } from "../hooks/useOrders.js";
import { useOrder } from "../hooks/useOrder.js";
import {
  downloadOrderCsv,
  orderRef,
  orderTypesOnOrder,
  selectOrderRows,
} from "../utils/exportCsv.js";
import { downloadOrderPdf } from "../utils/exportPdf.js";
import { orderUnitOf } from "../models/OrderModel.js";
import { formatDateTime } from "../utils/monthUtils.js";
import { useT } from "../i18n/i18n.jsx";

function StatusPill({ status }) {
  const { t } = useT();
  const map = {
    draft: { text: t("status_draft"), cls: "bg-n-100 text-n-600" },
    submitted: { text: t("status_submitted"), cls: "bg-accent-50 text-accent-700" },
  };
  const s = map[status] || map.draft;
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.text}
    </span>
  );
}

// Export controls: pick which order types to include, optionally untick single
// items, then take CSV or PDF. The type list comes from the order itself, so it
// never offers a type that would produce an empty file.
//
// IMPORTANT: every choice here lives in local component state and is passed to
// the export builders as a filter. Nothing is written back to the order — no
// mutation is called, `lines` is never modified — so unticking an item changes
// the file only. Reopening the order restores the full selection.
function ExportBar({ order, items, lines }) {
  const { t } = useT();
  const types = useMemo(() => orderTypesOnOrder(items, lines), [items, lines]);
  // null = "not touched yet" -> everything is selected.
  const [picked, setPicked] = useState(null);
  const selected = picked ?? types;
  const allOn = selected.length === types.length;

  // Item ids explicitly unticked for this export. Excluding (rather than
  // listing what's included) means items stay selected by default, including
  // any that appear after a refetch.
  const [excluded, setExcluded] = useState(() => new Set());
  const [showItems, setShowItems] = useState(false);

  const toggleType = (ty) =>
    setPicked(
      selected.includes(ty) ? selected.filter((x) => x !== ty) : [...selected, ty],
    );

  const toggleItem = (id) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Rows currently in scope: order-type filter applied, exclusions NOT — the
  // checklist has to show unticked items so they can be ticked back on.
  const rows = useMemo(
    () => selectOrderRows(items, lines, selected),
    [items, lines, selected],
  );
  const includedCount = rows.filter((r) => !excluded.has(r.item.id)).length;
  const none = includedCount === 0;

  const setAllItems = (on) =>
    setExcluded(on ? new Set() : new Set(rows.map((r) => r.item.id)));

  return (
    <div className="rounded-2xl border border-n-200 bg-n-0 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-n-500">
          {t("orderType")}
        </span>
        <button
          type="button"
          onClick={() => setPicked(allOn ? [] : types)}
          className="text-[11px] font-semibold text-accent-700 hover:underline"
        >
          {allOn ? t("selectNone") : t("selectAll")}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {types.map((ty) => {
          const on = selected.includes(ty);
          return (
            <button
              key={ty}
              type="button"
              aria-pressed={on}
              onClick={() => toggleType(ty)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                on
                  ? "bg-accent-600 border-accent-600 text-white"
                  : "bg-n-0 border-n-200 text-n-600 hover:border-accent-300"
              }`}
            >
              {ty}
            </button>
          );
        })}
        {types.length === 0 && (
          <span className="text-xs text-n-400">{t("noItemsOnOrder")}</span>
        )}
      </div>

      {rows.length > 0 && (
        <div className="rounded-xl border border-n-200">
          <button
            type="button"
            onClick={() => setShowItems((v) => !v)}
            aria-expanded={showItems}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-n-600"
          >
            <span>{t("chooseItems", { n: includedCount, total: rows.length })}</span>
            <span className="text-n-400">{showItems ? "▴" : "▾"}</span>
          </button>

          {showItems && (
            <div className="border-t border-n-200">
              <div className="flex gap-3 px-3 py-1.5 border-b border-n-100">
                <button
                  type="button"
                  onClick={() => setAllItems(true)}
                  className="text-[11px] font-semibold text-accent-700 hover:underline"
                >
                  {t("selectAll")}
                </button>
                <button
                  type="button"
                  onClick={() => setAllItems(false)}
                  className="text-[11px] font-semibold text-n-500 hover:underline"
                >
                  {t("selectNone")}
                </button>
              </div>
              <ul className="max-h-72 overflow-y-auto divide-y divide-n-100">
                {rows.map(({ item, orderType, line }, i) => {
                  const on = !excluded.has(item.id);
                  const newGroup = i === 0 || rows[i - 1].orderType !== orderType;
                  return (
                    <li key={item.id}>
                      {newGroup && (
                        <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-n-400">
                          {orderType}
                        </div>
                      )}
                      <label className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleItem(item.id)}
                          className="h-4 w-4 shrink-0 accent-accent-600"
                        />
                        <span
                          className={`flex-1 min-w-0 truncate text-xs ${
                            on ? "text-n-700" : "text-n-400 line-through"
                          }`}
                        >
                          {item.name}
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold text-n-500">
                          {line.qty} {orderUnitOf(item)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={none}
          onClick={() => downloadOrderCsv(order, items, lines, selected, excluded)}
          className="py-2.5 rounded-xl bg-n-100 border border-n-200 text-n-600 font-semibold hover:text-n-900 disabled:opacity-40 disabled:hover:text-n-600"
        >
          {t("exportCsv")}
        </button>
        <button
          disabled={none}
          onClick={() => downloadOrderPdf(order, items, lines, selected, excluded)}
          className="py-2.5 rounded-xl bg-accent-600 border border-accent-600 text-white font-semibold hover:bg-accent-700 disabled:opacity-40"
        >
          {t("exportPdf")}
        </button>
      </div>
      <p className="text-[11px] text-n-400 text-center">{t("exportSelectionHint")}</p>
    </div>
  );
}

// Admin editor for a single order.
function OrderEditor({ orderId, items, reporter, onBack }) {
  const { t } = useT();
  const oc = useOrder({ items, reporter, orderId });

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="h-9 w-9 grid place-items-center rounded-lg bg-n-0 border border-n-200 text-n-500 hover:bg-n-50"
          aria-label="back to orders"
        >
          ‹
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-n-900 truncate">
            {oc.order ? orderRef(oc.order) : "Order"}
          </div>
          <div className="text-xs text-n-500">{t("onOrderItems", { n: oc.summary.onOrder })}</div>
        </div>
        <StatusPill status={oc.status} />
      </div>

      {oc.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner label={t("loadingOrderShort")} />
        </div>
      ) : (
        <>
          <ExportBar order={oc.order} items={items} lines={oc.lines} />
          {oc.saveError && <p className="text-rose-600 text-sm text-center">{oc.saveError}</p>}
          <OrderNavigator
            items={items}
            lines={oc.lines}
            onAdd={oc.addLine}
            onRemove={oc.removeLine}
            busy={oc.saving}
          />
        </>
      )}
    </div>
  );
}

export default function OrdersAdmin({ reporter }) {
  const { t } = useT();
  const itemsQuery = useItems();
  const ordersQuery = useOrders();
  const [openId, setOpenId] = useState(null);

  const activeItems = useMemo(
    () => (itemsQuery.data || []).filter((i) => i.active !== false),
    [itemsQuery.data],
  );

  if (itemsQuery.isLoading || ordersQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label={t("loadingOrders")} />
      </div>
    );
  }

  if (openId) {
    return (
      <OrderEditor
        orderId={openId}
        items={activeItems}
        reporter={reporter}
        onBack={() => setOpenId(null)}
      />
    );
  }

  const orders = ordersQuery.data || [];

  return (
    <div className="space-y-3">
      {orders.length === 0 && (
        <div className="text-center py-12 text-n-500">{t("noOrders")}</div>
      )}
      {orders.map((o) => {
        const count = Object.keys(o.lines || {}).length;
        const when = o.submittedAt || o.createdAt;
        const label = when ? formatDateTime(new Date(when.seconds * 1000)) : "";
        return (
          <button
            key={o.id}
            onClick={() => setOpenId(o.id)}
            className="w-full text-left bg-n-0 border border-n-200 rounded-2xl p-3.5 hover:border-accent-300 hover:bg-accent-50/40 transition"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-n-900">{orderRef(o)}</span>
              <StatusPill status={o.status} />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-n-500">
              <span>{t("nItems", { n: count })}</span>
              <span>{label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
