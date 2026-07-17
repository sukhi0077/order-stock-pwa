// src/components/OrdersAdmin.jsx
import React, { useMemo, useState } from "react";
import Spinner from "./ui/Spinner.jsx";
import OrderNavigator from "./OrderNavigator.jsx";
import { useItems } from "../hooks/useItems.js";
import { useOrders } from "../hooks/useOrders.js";
import { useOrder } from "../hooks/useOrder.js";
import { downloadOrderCsv, orderRef } from "../utils/exportCsv.js";
import { formatDateTime } from "../utils/monthUtils.js";
import { useT } from "../i18n/i18n.jsx";

function StatusPill({ status }) {
  const { t } = useT();
  const map = {
    draft: { text: t("status_draft"), cls: "bg-slate-100 text-slate-600" },
    submitted: { text: t("status_submitted"), cls: "bg-teal-50 text-teal-700" },
  };
  const s = map[status] || map.draft;
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.text}
    </span>
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
          className="h-9 w-9 grid place-items-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
          aria-label="back to orders"
        >
          ‹
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-slate-900 truncate">
            {oc.order ? orderRef(oc.order) : "Order"}
          </div>
          <div className="text-xs text-slate-500">{t("onOrderItems", { n: oc.summary.onOrder })}</div>
        </div>
        <StatusPill status={oc.status} />
      </div>

      {oc.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner label={t("loadingOrderShort")} />
        </div>
      ) : (
        <>
          <button
            onClick={() => downloadOrderCsv(oc.order, items, oc.lines)}
            className="w-full py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 font-semibold hover:text-slate-900"
          >
            {t("exportCsv")}
          </button>
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
        <div className="text-center py-12 text-slate-500">{t("noOrders")}</div>
      )}
      {orders.map((o) => {
        const count = Object.keys(o.lines || {}).length;
        const when = o.submittedAt || o.createdAt;
        const label = when ? formatDateTime(new Date(when.seconds * 1000)) : "";
        return (
          <button
            key={o.id}
            onClick={() => setOpenId(o.id)}
            className="w-full text-left bg-white border border-slate-200 rounded-2xl p-3.5 hover:border-teal-300 hover:bg-teal-50/40 transition"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">{orderRef(o)}</span>
              <StatusPill status={o.status} />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{t("nItems", { n: count })}</span>
              <span>{label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
