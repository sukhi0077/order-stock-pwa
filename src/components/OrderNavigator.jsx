// src/components/OrderNavigator.jsx
//
// Same category -> sub-category -> items drill-down as the stock screen, but for
// building an order. Tiles show how many items in each group are on the order.
import React, { useMemo, useState } from "react";
import OrderItemRow from "./OrderItemRow.jsx";
import CategoryIcon from "./ui/CategoryIcon.jsx";
import { CATEGORY_ORDER, SUBCATEGORY_ORDER } from "../data/seedItems.js";
import { isOrdered, num, orderUnitOf } from "../models/OrderModel.js";
import { useT } from "../i18n/i18n.jsx";

function orderedKeys(keys, preferred) {
  const known = preferred.filter((k) => keys.includes(k));
  const extra = keys.filter((k) => !preferred.includes(k)).sort();
  return [...known, ...extra];
}

function Tile({ iconName, label, onOrder, total, onClick }) {
  const { t } = useT();
  const has = onOrder > 0;
  const pct = total ? Math.round((onOrder / total) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 rounded-2xl p-3 hover:border-teal-300 hover:bg-teal-50/40 transition"
    >
      <div className="flex items-center gap-2">
        <span className="text-teal-600">
          <CategoryIcon name={iconName} size={20} />
        </span>
        <span className="flex-1 min-w-0 text-base font-medium text-slate-800 leading-tight">
          {label}
        </span>
        <span className="text-slate-300 shrink-0" aria-hidden>
          ›
        </span>
      </div>
      <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className={`mt-1.5 text-[11px] font-medium ${has ? "text-teal-600" : "text-slate-400"}`}>
        {has ? t("onOrderN", { n: onOrder }) : t("noneYet")}
      </div>
    </button>
  );
}


export default function OrderNavigator({ items, lines, onAdd, onRemove, onSubmit, busy }) {
  const { t, tc, ts, ti } = useT();
  const [nav, setNav] = useState({ level: "cat", cat: null, sub: null });
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!query) return [];
    return items
      .filter(
        (it) =>
          it.name.toLowerCase().includes(query) || ti(it.name, it).toLowerCase().includes(query),
      )
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .slice(0, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query]);

  const SearchBox = (
    <input
      type="search"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder={t("searchItems")}
      className="w-full p-3 rounded-xl bg-white border border-slate-300 text-slate-900 text-base outline-none focus:ring-2 focus:ring-teal-500"
    />
  );

  const ResultRows = (
    <div className="space-y-1.5">
      {searchResults.length === 0 ? (
        <p className="text-center text-slate-400 py-8">{t("noItemsFound")}</p>
      ) : (
        searchResults.map((item) => (
          <OrderItemRow
            key={item.id}
            item={item}
            line={lines[item.id]}
            onAdd={onAdd}
            onRemove={onRemove}
            busy={busy}
          />
        ))
      )}
    </div>
  );

  const groups = useMemo(() => {
    const g = {};
    for (const it of items) {
      const c = it.category || "Uncategorized";
      const s = it.subCategory || "Other";
      g[c] = g[c] || {};
      g[c][s] = g[c][s] || [];
      g[c][s].push(it);
    }
    for (const c of Object.keys(g))
      for (const s of Object.keys(g[c]))
        g[c][s].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return g;
  }, [items]);

  const catProg = useMemo(() => {
    const p = {};
    for (const it of items) {
      const c = it.category || "Uncategorized";
      p[c] = p[c] || { onOrder: 0, total: 0 };
      p[c].total += 1;
      if (isOrdered(lines[it.id])) p[c].onOrder += 1;
    }
    return p;
  }, [items, lines]);

  const subProg = useMemo(() => {
    const p = {};
    for (const it of items) {
      const c = it.category || "Uncategorized";
      const s = it.subCategory || "Other";
      p[c] = p[c] || {};
      p[c][s] = p[c][s] || { onOrder: 0, total: 0 };
      p[c][s].total += 1;
      if (isOrdered(lines[it.id])) p[c][s].onOrder += 1;
    }
    return p;
  }, [items, lines]);

  const orderedItems = useMemo(
    () =>
      items
        .filter((i) => isOrdered(lines[i.id]))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [items, lines],
  );

  // The running list grouped by category -> sub-category (order home screen).
  const orderedByCat = useMemo(() => {
    const g = {};
    for (const item of orderedItems) {
      const c = item.category || "Uncategorized";
      const s = item.subCategory || "Other";
      g[c] = g[c] || {};
      (g[c][s] = g[c][s] || []).push(item);
    }
    return g;
  }, [orderedItems]);

  // ---- Level 1: categories ----
  if (nav.level === "cat") {
    const cats = orderedKeys(Object.keys(groups), CATEGORY_ORDER);
    return (
      <div className="space-y-4">
        {SearchBox}
        {query ? (
          ResultRows
        ) : (
          <>
        <div className="grid grid-cols-2 gap-2.5">
          {cats.map((cat) => (
            <Tile
              key={cat}
              iconName={cat}
              label={tc(cat)}
              onOrder={catProg[cat]?.onOrder || 0}
              total={catProg[cat]?.total || 0}
              onClick={() => setNav({ level: "sub", cat, sub: null })}
            />
          ))}
        </div>

        {/* Running list of items already on the order */}
        {orderedItems.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-slate-900">{t("onThisOrder")}</h3>
              <span className="text-xs text-slate-500">{t("nItems", { n: orderedItems.length })}</span>
            </div>
            {orderedKeys(Object.keys(orderedByCat), CATEGORY_ORDER).map((cat) => (
              <div key={cat} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="text-teal-600">
                    <CategoryIcon name={cat} size={16} />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {tc(cat)}
                  </span>
                  <span className="text-[11px] text-slate-400">· {catProg[cat]?.onOrder || 0}</span>
                </div>
                {orderedKeys(Object.keys(orderedByCat[cat]), SUBCATEGORY_ORDER[cat] || []).map((sub) => (
                  <div key={sub}>
                    <div className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-teal-600/80">
                      {ts(sub)}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {orderedByCat[cat][sub].map((item) => {
                        const line = lines[item.id] || {};
                        return (
                          <div key={item.id} className="flex items-center gap-2 pl-3 pr-2 py-2">
                            <button
                              type="button"
                              onClick={() =>
                                setNav({
                                  level: "items",
                                  cat: item.category || "Uncategorized",
                                  sub: item.subCategory || "Other",
                                })
                              }
                              className="flex-1 min-w-0 text-left"
                            >
                              <div className="text-sm font-medium text-slate-800 break-words">
                                {ti(item.name, item)}
                              </div>
                              {line.note && (
                                <div className="text-[11px] text-slate-400 truncate">{line.note}</div>
                              )}
                            </button>
                            <span className="text-sm font-semibold text-teal-700 shrink-0 whitespace-nowrap">
                              {num(line.qty)}{" "}
                              <span className="text-[11px] text-slate-400 font-normal">
                                {orderUnitOf(item)}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => onRemove(item.id)}
                              className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 text-lg leading-none"
                              aria-label={`remove ${item.name}`}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {onSubmit && orderedItems.length > 0 && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold disabled:opacity-50 transition"
          >
            {t("submitOrder")}
          </button>
        )}
          </>
        )}
      </div>
    );
  }

  // ---- Level 2: sub-categories ----
  if (nav.level === "sub") {
    const cat = nav.cat;
    const subs = orderedKeys(Object.keys(groups[cat] || {}), SUBCATEGORY_ORDER[cat] || []);
    return (
      <div className="space-y-4">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setNav({ level: "cat", cat: null, sub: null })}
            className="h-9 w-9 grid place-items-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label="back"
          >
            ‹
          </button>
          <div className="flex-1 text-center text-lg font-bold text-slate-900 truncate px-2">
            {tc(cat)}
          </div>
          <span className="w-9" />
        </div>
        {SearchBox}
        {query ? (
          ResultRows
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {subs.map((sub) => (
              <Tile
                key={sub}
                iconName={sub}
                label={ts(sub)}
                onOrder={subProg[cat]?.[sub]?.onOrder || 0}
                total={subProg[cat]?.[sub]?.total || 0}
                onClick={() => setNav({ level: "items", cat, sub })}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- Level 3: items ----
  const { cat, sub } = nav;
  const rows = groups[cat]?.[sub] || [];
  const sp = subProg[cat]?.[sub] || { onOrder: 0, total: 0 };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setNav({ level: "sub", cat, sub: null })}
          className="h-9 w-9 grid place-items-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
          aria-label="back"
        >
          ‹
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-slate-400 truncate">{tc(cat)}</div>
          <div className="text-base font-bold text-slate-900 leading-tight truncate">{ts(sub)}</div>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
          {t("onOrderN", { n: sp.onOrder })}
        </span>
      </div>
      <div className="space-y-1.5">
        {rows.map((item) => (
          <OrderItemRow
            key={item.id}
            item={item}
            line={lines[item.id]}
            onAdd={onAdd}
            onRemove={onRemove}
            busy={busy}
          />
        ))}
      </div>
    </div>
  );
}
