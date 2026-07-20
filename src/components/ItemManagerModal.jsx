// src/components/ItemManagerModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSetItemActive, useUpdateItem } from "../hooks/useItems.js";
import { useMasterData } from "../hooks/useMasterData.js";
import { useT } from "../i18n/i18n.jsx";

// A small filter chip.
function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
        active
          ? "bg-teal-600 border-teal-600 text-white"
          : "bg-white border-slate-200 text-slate-600 hover:border-teal-300"
      }`}
    >
      {children}
    </button>
  );
}

// Inline editable supplier for one item — saves on blur when changed.
function SupplierField({ item, listId, onSave }) {
  const { t } = useT();
  const [val, setVal] = useState(item.supplier || "");
  useEffect(() => setVal(item.supplier || ""), [item.supplier]);
  const commit = () => {
    const v = val.trim();
    if (v !== (item.supplier || "")) onSave(item.id, v);
  };
  return (
    <input
      list={listId}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      placeholder={t("supplier")}
      className="flex-1 min-w-0 text-xs px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
    />
  );
}

// Admin page: browse/filter the catalogue and adjust the three things managed
// here — enable/disable, supplier, and order unit. Items are created and renamed
// upstream (master data); nothing is hard-deleted, so historical months keep
// their references.
export default function ItemManagerModal({ items, onBack }) {
  const { t, tc, ts, ti } = useT();
  const setActive = useSetItemActive();
  const updateItem = useUpdateItem();
  // Category / sub-category / unit options from the master-data tables
  // (falls back to the bundled seed lists if those tables are empty).
  const { categories, subByCategory } = useMasterData();

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState(null);
  const [filterSub, setFilterSub] = useState(null);
  // Distinct suppliers already in use — powers the autocomplete datalist.
  const suppliers = useMemo(() => {
    const set = new Set();
    for (const i of items) if (i.supplier) set.add(i.supplier);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);
  const saveSupplier = (id, supplier) => updateItem.mutate({ id, patch: { supplier } });
  const saveOrderUnit = (id, orderUnit) => updateItem.mutate({ id, patch: { orderUnit } });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items;
    if (q)
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) || ti(i.name, i).toLowerCase().includes(q),
      );
    if (filterCat) list = list.filter((i) => i.category === filterCat);
    if (filterSub) list = list.filter((i) => i.subCategory === filterSub);
    return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [items, search, filterCat, filterSub, ti]);

  return (
    <div className="max-w-2xl mx-auto p-4 pb-16">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onBack}
          className="h-9 w-9 grid place-items-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
          aria-label="back"
        >
          ‹
        </button>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t("manageItems")}</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl">
        <datalist id="supplier-options">
          {suppliers.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <div className="px-4 py-2 border-b border-slate-200 space-y-2 sticky top-14 bg-white z-10">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchItems")}
            className="w-full p-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-sm outline-none focus:ring-2 focus:ring-teal-500"
          />
          {/* Quick category filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            <Chip
              active={!filterCat}
              onClick={() => {
                setFilterCat(null);
                setFilterSub(null);
              }}
            >
              {t("all")}
            </Chip>
            {categories.map((c) => (
              <Chip
                key={c}
                active={filterCat === c}
                onClick={() => {
                  setFilterCat(c);
                  setFilterSub(null);
                }}
              >
                {tc(c)}
              </Chip>
            ))}
          </div>
          {/* Quick sub-category filter (for the chosen category) */}
          {filterCat && (subByCategory[filterCat] || []).length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              <Chip active={!filterSub} onClick={() => setFilterSub(null)}>
                {t("all")}
              </Chip>
              {(subByCategory[filterCat] || []).map((s) => (
                <Chip key={s} active={filterSub === s} onClick={() => setFilterSub(s)}>
                  {ts(s)}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 divide-y divide-slate-100">
          {filtered.map((item) => {
            const masterOff = item.globalActive === false; // disabled in SupplyTracker
            const localOff = item.ospActive === false; // disabled here only
            const inactive = localOff; // the toggle reflects the LOCAL switch
            const unavailable = localOff || masterOff;
            return (
              <div key={item.id} className={`py-2 ${unavailable ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium break-words ${unavailable ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {ti(item.name, item)}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {tc(item.category)} · {ts(item.subCategory)} · {item.unit}
                    </div>
                  </div>
                  {masterOff && (
                    <span
                      title="Disabled in SupplyTracker (master). Re-enable it there."
                      className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                    >
                      master
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
                      inactive ? "text-slate-400" : "text-teal-600"
                    }`}
                  >
                    {inactive ? t("off") : t("on")}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!inactive}
                    disabled={masterOff}
                    aria-label={inactive ? t("reactivate") : t("deactivate")}
                    onClick={() => setActive.mutate({ id: item.id, active: inactive })}
                    className={`relative h-6 w-11 rounded-full shrink-0 transition ${
                      masterOff ? "cursor-not-allowed bg-slate-200" : inactive ? "bg-slate-300" : "bg-teal-500"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        inactive ? "left-0.5" : "left-[22px]"
                      }`}
                    />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 shrink-0">{t("supplier")}</span>
                  <SupplierField item={item} listId="supplier-options" onSave={saveSupplier} />
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 shrink-0">{t("orderUnit")}</span>
                  {(() => {
                    const base = item.unit || "";
                    const ou = item.orderUnit || item.unit || "";
                    if (base === "pack")
                      return <span className="text-[11px] text-slate-500">pack</span>;
                    return (
                      <div className="inline-flex rounded-lg border border-teal-200 overflow-hidden">
                        {[base, "pack"].map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => saveOrderUnit(item.id, u)}
                            aria-pressed={ou === u}
                            className={`text-[11px] font-semibold px-2.5 py-1 transition ${
                              ou === u ? "bg-teal-600 text-white" : "bg-white text-slate-500"
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-slate-400 text-sm">{t("noItemsFound")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
