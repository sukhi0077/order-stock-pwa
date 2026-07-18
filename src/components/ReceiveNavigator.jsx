// src/components/ReceiveNavigator.jsx
//
// Category -> sub-category -> items drill-down for logging received batches,
// styled to match the order dashboard but in an AMBER theme so the "receive"
// area is visually distinct.
import React, { useMemo, useState } from "react";
import ReceiveItemRow from "./ReceiveItemRow.jsx";
import ExpiryBadge from "./ui/ExpiryBadge.jsx";
import CategoryIcon from "./ui/CategoryIcon.jsx";
import { CATEGORY_ORDER, SUBCATEGORY_ORDER } from "../data/seedItems.js";
import { num } from "../models/ReceiptModel.js";
import { formatDay } from "../utils/monthUtils.js";
import { useT } from "../i18n/i18n.jsx";

function orderedKeys(keys, preferred) {
  const known = preferred.filter((k) => keys.includes(k));
  const extra = keys.filter((k) => !preferred.includes(k)).sort();
  return [...known, ...extra];
}

function Tile({ iconName, label, count, onClick }) {
  const { t } = useT();
  const has = count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 rounded-2xl p-3 hover:border-blue-300 hover:bg-blue-50/40 transition"
    >
      <div className="flex items-center gap-2">
        <span className="text-blue-600">
          <CategoryIcon name={iconName} size={20} />
        </span>
        <span className="flex-1 min-w-0 text-base font-medium text-slate-800 leading-tight">
          {label}
        </span>
        <span className="text-slate-300 shrink-0" aria-hidden>
          ›
        </span>
      </div>
      <div className={`mt-2 text-[11px] font-medium ${has ? "text-blue-700" : "text-slate-400"}`}>
        {has ? t("receivedCount", { n: count }) : t("noneYet")}
      </div>
    </button>
  );
}

export default function ReceiveNavigator({ items, receipts, onAdd, onDelete, adding }) {
  const { t, tc, ts, ti } = useT();
  const [nav, setNav] = useState({ level: "cat", cat: null, sub: null });
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

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

  const itemsById = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i])),
    [items],
  );

  // itemId -> batches (sorted by soonest expiry)
  const batchesByItem = useMemo(() => {
    const m = {};
    for (const r of receipts) (m[r.itemId] = m[r.itemId] || []).push(r);
    for (const k of Object.keys(m))
      m[k].sort((a, b) => String(a.expiry).localeCompare(String(b.expiry)));
    return m;
  }, [receipts]);

  const catCount = useMemo(() => {
    const p = {};
    for (const r of receipts) {
      const it = itemsById[r.itemId];
      const c = it?.category || r.category || "Uncategorized";
      p[c] = (p[c] || 0) + 1;
    }
    return p;
  }, [receipts, itemsById]);

  const subCount = useMemo(() => {
    const p = {};
    for (const r of receipts) {
      const it = itemsById[r.itemId];
      const c = it?.category || r.category || "Uncategorized";
      const s = it?.subCategory || r.subCategory || "Other";
      p[c] = p[c] || {};
      p[c][s] = (p[c][s] || 0) + 1;
    }
    return p;
  }, [receipts, itemsById]);

  const recent = useMemo(
    () =>
      [...receipts]
        .sort((a, b) => (b.receivedAt?.seconds || 0) - (a.receivedAt?.seconds || 0))
        .slice(0, 12),
    [receipts],
  );
  const nameOf = (r) => {
    const it = itemsById[r.itemId];
    return it ? ti(it.name, it) : ti(r.itemName);
  };

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
      className="w-full p-3 rounded-xl bg-white border border-slate-300 text-slate-900 text-base outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
  const ResultRows = (
    <div className="space-y-1.5">
      {searchResults.length === 0 ? (
        <p className="text-center text-slate-400 py-8">{t("noItemsFound")}</p>
      ) : (
        searchResults.map((item) => (
          <ReceiveItemRow
            key={item.id}
            item={item}
            batches={batchesByItem[item.id] || []}
            onAdd={onAdd}
            onDelete={onDelete}
            adding={adding}
          />
        ))
      )}
    </div>
  );

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
              count={catCount[cat] || 0}
              onClick={() => setNav({ level: "sub", cat, sub: null })}
            />
          ))}
        </div>

        {recent.length > 0 && (
          <div className="space-y-2 pt-1">
            <h3 className="text-sm font-bold text-slate-900 px-1">{t("recentlyReceived")}</h3>
            <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
              {recent.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 break-words">{nameOf(r)}</div>
                    <div className="text-[11px] text-slate-500">
                      {num(r.qty)} {r.unit} · {t("expires")} {formatDay(r.expiry)}
                    </div>
                  </div>
                  <ExpiryBadge expiry={r.expiry} />
                  <button
                    onClick={() => {
                      if (window.confirm(t("removeReceipt"))) onDelete(r.id);
                    }}
                    className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 text-lg leading-none"
                    aria-label="remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
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
                count={subCount[cat]?.[sub] || 0}
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
      </div>
      <div className="space-y-1.5">
        {rows.map((item) => (
          <ReceiveItemRow
            key={item.id}
            item={item}
            batches={batchesByItem[item.id] || []}
            onAdd={onAdd}
            onDelete={onDelete}
            adding={adding}
          />
        ))}
      </div>
    </div>
  );
}
