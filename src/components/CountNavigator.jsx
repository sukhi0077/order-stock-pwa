// src/components/CountNavigator.jsx
//
// Three-level drill-down for entering closing counts (light / teal theme):
//   1. Categories     — centered progress ring + a 2-col grid of category tiles
//   2. Sub-categories — the same layout, scoped to the chosen category
//   3. Items          — the stepper rows for the chosen sub-category
import React, { useMemo, useState } from "react";
import ItemRow from "./ItemRow.jsx";
import Ring from "./ui/Ring.jsx";
import CategoryIcon from "./ui/CategoryIcon.jsx";
import { CATEGORY_ORDER, SUBCATEGORY_ORDER } from "../data/seedItems.js";
import { isCounted, num } from "../models/StockCountModel.js";
import { useT } from "../i18n/i18n.jsx";

function orderedKeys(keys, preferred) {
  const known = preferred.filter((k) => keys.includes(k));
  const extra = keys.filter((k) => !preferred.includes(k)).sort();
  return [...known, ...extra];
}

function pctOf({ done, total }) {
  return total ? Math.round((done / total) * 100) : 0;
}

// A tappable tile (mockup-4 style): icon + name + chevron, a thin progress bar,
// then an "X / Y counted" caption.
function Tile({ iconName, label, done, total, onClick }) {
  const { t } = useT();
  const pct = pctOf({ done, total });
  const complete = total > 0 && done === total;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 rounded-2xl p-3 hover:border-amber-300 hover:bg-amber-50/40 transition"
    >
      <div className="flex items-center gap-2">
        <span className={complete ? "text-emerald-600" : "text-amber-600"}>
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
        <div
          className={`h-full rounded-full transition-all ${complete ? "bg-emerald-500" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className={`mt-1.5 text-[11px] font-medium ${complete ? "text-emerald-600" : "text-slate-500"}`}
      >
        {complete ? t("allCounted", { total }) : t("countedOf", { done, total })}
      </div>
    </button>
  );
}

export default function CountNavigator({
  items,
  counts,
  prevClosing = {},
  onCommit,
  onSubmit,
  disabled,
}) {
  const { t, tc, ts, ti } = useT();
  const [nav, setNav] = useState({ level: "cat", cat: null, sub: null });
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

  // cat -> sub -> [items]
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
      p[c] = p[c] || { done: 0, total: 0 };
      p[c].total += 1;
      if (isCounted(counts[it.id])) p[c].done += 1;
    }
    return p;
  }, [items, counts]);

  const subProg = useMemo(() => {
    const p = {};
    for (const it of items) {
      const c = it.category || "Uncategorized";
      const s = it.subCategory || "Other";
      p[c] = p[c] || {};
      p[c][s] = p[c][s] || { done: 0, total: 0 };
      p[c][s].total += 1;
      if (isCounted(counts[it.id])) p[c][s].done += 1;
    }
    return p;
  }, [items, counts]);

  const overall = useMemo(
    () => ({
      done: items.filter((i) => isCounted(counts[i.id])).length,
      total: items.length,
    }),
    [items, counts],
  );

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
      className="w-full p-3 rounded-xl bg-white border border-slate-300 text-slate-900 text-base outline-none focus:ring-2 focus:ring-amber-500"
    />
  );
  const ResultRows = (
    <div className="space-y-1.5">
      {searchResults.length === 0 ? (
        <p className="text-center text-slate-400 py-8">{t("noItemsFound")}</p>
      ) : (
        searchResults.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            value={counts[item.id]}
            prev={prevClosing[item.id]}
            disabled={disabled}
            onCommit={onCommit}
          />
        ))
      )}
    </div>
  );

  // ---- Level 1: categories ----------------------------------------------
  if (nav.level === "cat") {
    const cats = orderedKeys(Object.keys(groups), CATEGORY_ORDER);
    const pct = pctOf(overall);
    return (
      <div className="space-y-5">
        {SearchBox}
        {query ? (
          ResultRows
        ) : (
          <>
        <div className="flex flex-col items-center pt-2">
          <Ring percent={pct} size={132} stroke={13}>
            <span className="text-3xl font-bold text-slate-900 leading-none">{pct}%</span>
            <span className="text-xs text-slate-500 mt-1">
              {overall.done} / {overall.total}
            </span>
          </Ring>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {cats.map((cat) => (
            <Tile
              key={cat}
              iconName={cat}
              label={tc(cat)}
              done={catProg[cat]?.done || 0}
              total={catProg[cat]?.total || 0}
              onClick={() => setNav({ level: "sub", cat, sub: null })}
            />
          ))}
        </div>

        {/* Counted list, grouped by category -> sub-category */}
        {overall.done > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-slate-900">{t("counted")}</h3>
              <span className="text-xs text-slate-500">
                {overall.done}/{overall.total}
              </span>
            </div>
            {cats
              .filter((cat) => (catProg[cat]?.done || 0) > 0)
              .map((cat) => (
                <div key={cat} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-amber-600">
                      <CategoryIcon name={cat} size={16} />
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {tc(cat)}
                    </span>
                    <span className="text-[11px] text-slate-400">· {catProg[cat].done}</span>
                  </div>
                  {orderedKeys(Object.keys(groups[cat]), SUBCATEGORY_ORDER[cat] || [])
                    .filter((sub) => (subProg[cat]?.[sub]?.done || 0) > 0)
                    .map((sub) => (
                      <div key={sub}>
                        <div className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-amber-600/80">
                          {ts(sub)}
                        </div>
                        <div className="divide-y divide-slate-100">
                          {groups[cat][sub]
                            .filter((it) => isCounted(counts[it.id]))
                            .map((it) => (
                              <div key={it.id} className="flex items-center gap-2 px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => setNav({ level: "items", cat, sub })}
                                  className="flex-1 min-w-0 text-left text-sm font-medium text-slate-800 truncate"
                                >
                                  {ti(it.name, it)}
                                </button>
                                <span className="text-sm font-semibold text-amber-700 shrink-0 whitespace-nowrap">
                                  {num(counts[it.id])}{" "}
                                  <span className="text-[11px] text-slate-400 font-normal">{it.unit}</span>
                                </span>
                                {!disabled && (
                                  <button
                                    type="button"
                                    onClick={() => onCommit(it.id, "")}
                                    className="h-6 w-6 grid place-items-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 leading-none"
                                    aria-label="remove"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                </div>
              ))}
          </div>
        )}

        {onSubmit && overall.done > 0 && !disabled && (
          <button
            type="button"
            onClick={onSubmit}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold transition"
          >
            {t("submitStock")}
          </button>
        )}
          </>
        )}
      </div>
    );
  }

  // ---- Level 2: sub-categories ------------------------------------------
  if (nav.level === "sub") {
    const cat = nav.cat;
    const subs = orderedKeys(Object.keys(groups[cat] || {}), SUBCATEGORY_ORDER[cat] || []);
    const cp = catProg[cat] || { done: 0, total: 0 };
    const pct = pctOf(cp);
    return (
      <div className="space-y-5">
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
          <>
            <div className="flex flex-col items-center">
              <Ring percent={pct} size={112} stroke={12}>
                <span className="text-2xl font-bold text-slate-900 leading-none">{pct}%</span>
                <span className="text-xs text-slate-500 mt-1">
                  {cp.done} / {cp.total}
                </span>
              </Ring>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {subs.map((sub) => (
                <Tile
                  key={sub}
                  iconName={sub}
                  label={ts(sub)}
                  done={subProg[cat]?.[sub]?.done || 0}
                  total={subProg[cat]?.[sub]?.total || 0}
                  onClick={() => setNav({ level: "items", cat, sub })}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ---- Level 3: items ----------------------------------------------------
  const { cat, sub } = nav;
  const rows = groups[cat]?.[sub] || [];
  const sp = subProg[cat]?.[sub] || { done: 0, total: 0 };
  const pct = pctOf(sp);
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
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            sp.done === sp.total ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {sp.done}/{sp.total}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="space-y-1.5">
        {rows.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            value={counts[item.id]}
            prev={prevClosing[item.id]}
            disabled={disabled}
            onCommit={onCommit}
          />
        ))}
      </div>
    </div>
  );
}
