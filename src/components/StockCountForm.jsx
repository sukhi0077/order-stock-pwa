// src/components/StockCountForm.jsx
import React, { useMemo, useState } from "react";
import ItemRow from "./ItemRow.jsx";
import { CATEGORY_ORDER, SUBCATEGORY_ORDER } from "../data/seedItems.js";
import { isCounted } from "../models/StockCountModel.js";

// Order helper: known categories/subcategories first (spreadsheet order), then
// any unknowns alphabetically.
function orderedKeys(keys, preferred) {
  const known = preferred.filter((k) => keys.includes(k));
  const extra = keys.filter((k) => !preferred.includes(k)).sort();
  return [...known, ...extra];
}

function ProgressBar({ done, total, className = "" }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={`h-1.5 rounded-full bg-slate-700/70 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${done === total && total ? "bg-emerald-500" : "bg-sky-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function StockCountForm({
  items,
  counts,
  prevClosing = {},
  setCount,
  disabled,
}) {
  const [searchRaw, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [onlyRemaining, setOnlyRemaining] = useState(false);
  const search = searchRaw.trim().toLowerCase();

  // Group items by category -> subcategory, applying search + "remaining" filter.
  const grouped = useMemo(() => {
    const g = {};
    for (const item of items) {
      if (search && !item.name.toLowerCase().includes(search)) continue;
      if (onlyRemaining && isCounted(counts[item.id])) continue;
      const cat = item.category || "Uncategorized";
      const sub = item.subCategory || "Other";
      g[cat] = g[cat] || {};
      g[cat][sub] = g[cat][sub] || [];
      g[cat][sub].push(item);
    }
    for (const cat of Object.keys(g))
      for (const sub of Object.keys(g[cat]))
        g[cat][sub].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return g;
  }, [items, search, onlyRemaining, counts]);

  const categories = orderedKeys(Object.keys(grouped), CATEGORY_ORDER);

  // Force-open while filtering so matches are visible.
  const filtering = search.length > 0 || onlyRemaining;
  const isOpen = (cat) => filtering || !collapsed.has(cat);
  const toggleCat = (cat) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  // counted / total for a (possibly filtered) category, using the FULL item set
  // so the badge reflects real progress, not just what's visible.
  const catProgress = useMemo(() => {
    const p = {};
    for (const item of items) {
      const cat = item.category || "Uncategorized";
      if (!p[cat]) p[cat] = { done: 0, total: 0 };
      p[cat].total += 1;
      if (isCounted(counts[item.id])) p[cat].done += 1;
    }
    return p;
  }, [items, counts]);

  return (
    <div className="space-y-3">
      {/* Search + filter toggle */}
      <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-slate-900/95 backdrop-blur space-y-2">
        <input
          type="search"
          value={searchRaw}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items…"
          className="w-full p-3 rounded-xl bg-slate-800 border border-slate-600 text-slate-100 outline-none focus:ring-2 focus:ring-sky-500 transition"
        />
        <label className="flex items-center gap-2 text-xs text-slate-300 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={onlyRemaining}
            onChange={(e) => setOnlyRemaining(e.target.checked)}
            className="h-4 w-4 accent-sky-500"
          />
          Show only items not yet counted
        </label>
      </div>

      {categories.length === 0 && (
        <p className="text-center text-slate-400 py-8">
          {onlyRemaining ? "Everything visible is counted. 🎉" : `No items match “${searchRaw}”.`}
        </p>
      )}

      {categories.map((cat) => {
        const { done, total } = catProgress[cat] || { done: 0, total: 0 };
        const subs = orderedKeys(
          Object.keys(grouped[cat]),
          SUBCATEGORY_ORDER[cat] || [],
        );
        const open = isOpen(cat);
        return (
          <div
            key={cat}
            className="bg-slate-800/70 border border-slate-700 rounded-2xl overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleCat(cat)}
              className="w-full px-4 py-3 hover:bg-slate-700/30 transition text-left"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-bold text-slate-100">
                  <span
                    className={`text-slate-400 text-xs transition-transform ${open ? "rotate-90" : ""}`}
                  >
                    ▶
                  </span>
                  {cat}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    done === total
                      ? "bg-emerald-500/20 text-emerald-300"
                      : done > 0
                        ? "bg-sky-500/20 text-sky-300"
                        : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {done}/{total}
                </span>
              </div>
              <ProgressBar done={done} total={total} className="mt-2" />
            </button>

            {open && (
              <div className="px-3 pb-3">
                {subs.map((sub) => (
                  <div key={sub} className="mt-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-sky-300/70 mt-3 mb-1.5 px-1">
                      {sub}
                    </h4>
                    <div className="space-y-1.5">
                      {grouped[cat][sub].map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          value={counts[item.id]}
                          prev={prevClosing[item.id]}
                          disabled={disabled}
                          onChange={setCount}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
