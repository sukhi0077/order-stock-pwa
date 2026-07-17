// src/components/ItemManagerModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  useAddItem,
  useSetItemActive,
  useUpdateItem,
  useResyncItems,
} from "../hooks/useItems.js";
import { CATEGORY_ORDER, SUBCATEGORY_ORDER, UNITS, SEED_COUNT } from "../data/seedItems.js";
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

// Inline full editor for one item (name, category, sub-category, unit, supplier).
function EditRow({ item, onSave, onCancel }) {
  const { t, tc, ts } = useT();
  const [f, setF] = useState({
    name: item.name || "",
    nameHi: item.nameHi || "",
    category: item.category || CATEGORY_ORDER[0],
    subCategory: item.subCategory || "",
    unit: item.unit || UNITS[0],
    supplier: item.supplier || "",
  });
  const subs = SUBCATEGORY_ORDER[f.category] || [];
  const sel =
    "p-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-base outline-none focus:ring-2 focus:ring-teal-500";

  const save = () => {
    if (!f.name.trim()) return;
    onSave({
      name: f.name.trim(),
      nameHi: f.nameHi.trim(),
      category: f.category,
      subCategory: f.subCategory,
      unit: f.unit,
      supplier: f.supplier.trim(),
    });
  };

  return (
    <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 space-y-2">
      <input
        value={f.name}
        onChange={(e) => setF((v) => ({ ...v, name: e.target.value }))}
        className="w-full p-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
      />
      <input
        value={f.nameHi}
        onChange={(e) => setF((v) => ({ ...v, nameHi: e.target.value }))}
        placeholder={t("hindiName")}
        lang="hi"
        className="w-full p-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
      />
      <div className="grid grid-cols-3 gap-2">
        <select
          value={f.category}
          onChange={(e) => {
            const cat = e.target.value;
            const list = SUBCATEGORY_ORDER[cat] || [];
            setF((v) => ({
              ...v,
              category: cat,
              subCategory: list.includes(v.subCategory) ? v.subCategory : list[0] || "",
            }));
          }}
          className={sel}
        >
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {tc(c)}
            </option>
          ))}
        </select>
        <select
          value={f.subCategory}
          onChange={(e) => setF((v) => ({ ...v, subCategory: e.target.value }))}
          className={sel}
        >
          {subs.map((s) => (
            <option key={s} value={s}>
              {ts(s)}
            </option>
          ))}
        </select>
        <select
          value={f.unit}
          onChange={(e) => setF((v) => ({ ...v, unit: e.target.value }))}
          className={sel}
        >
          {UNITS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </div>
      <input
        list="supplier-options"
        value={f.supplier}
        onChange={(e) => setF((v) => ({ ...v, supplier: e.target.value }))}
        placeholder={t("supplierOptional")}
        className="w-full p-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg bg-white border border-slate-300 text-slate-600 font-semibold text-sm hover:bg-slate-50"
        >
          {t("cancel")}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!f.name.trim()}
          className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm disabled:opacity-50"
        >
          {t("save")}
        </button>
      </div>
    </div>
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

// Admin page: add a new item, filter/search, toggle active, edit supplier, or
// reload from the master list. Items are never hard-deleted so historical
// months keep their references.
export default function ItemManagerModal({ items, onBack }) {
  const { t, tc, ts, ti } = useT();
  const addItem = useAddItem();
  const setActive = useSetItemActive();
  const updateItem = useUpdateItem();
  const resync = useResyncItems();

  const handleResync = async () => {
    if (!window.confirm(t("reloadConfirm", { n: SEED_COUNT }))) return;
    try {
      const r = await resync.mutateAsync();
      window.alert(t("reloadDone", r));
    } catch (e) {
      window.alert(e?.message || "Failed to reload items.");
    }
  };

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState(null);
  const [filterSub, setFilterSub] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    category: CATEGORY_ORDER[0],
    subCategory: (SUBCATEGORY_ORDER[CATEGORY_ORDER[0]] || [])[0] || "",
    unit: UNITS[0],
    supplier: "",
  });

  const subOptions = SUBCATEGORY_ORDER[form.category] || [];

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

  const maxSort = useMemo(
    () => items.reduce((m, i) => Math.max(m, i.sortOrder ?? 0), 0),
    [items],
  );

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await addItem.mutateAsync({
      name: form.name.trim(),
      category: form.category,
      subCategory: form.subCategory,
      unit: form.unit,
      supplier: form.supplier.trim(),
      sortOrder: maxSort + 1,
    });
    setForm((f) => ({ ...f, name: "" }));
  };

  const sel =
    "p-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-base outline-none focus:ring-2 focus:ring-teal-500";

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
        {/* Add new item — a clearly separate, collapsible area */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 font-semibold text-sm hover:bg-teal-100 transition"
          >
            <span className="flex items-center gap-2">
              <span className="text-base leading-none">＋</span>
              {t("addNewItem")}
            </span>
            <span className="text-lg leading-none">{showAdd ? "−" : "+"}</span>
          </button>

          {showAdd && (
            <form
              onSubmit={handleAdd}
              className="mt-2 p-3 rounded-xl bg-teal-50/60 border border-teal-200 space-y-2"
            >
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("newItemName")}
                className="w-full p-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
              />
              <div className="grid grid-cols-3 gap-2">
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value,
                  subCategory: (SUBCATEGORY_ORDER[e.target.value] || [])[0] || "",
                }))
              }
              className={sel}
            >
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {tc(c)}
                </option>
              ))}
            </select>
            <select
              value={form.subCategory}
              onChange={(e) => setForm((f) => ({ ...f, subCategory: e.target.value }))}
              className={sel}
            >
              {subOptions.map((s) => (
                <option key={s} value={s}>
                  {ts(s)}
                </option>
              ))}
            </select>
            <select
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              className={sel}
            >
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <input
            list="supplier-options"
            value={form.supplier}
            onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
            placeholder={t("supplierOptional")}
            className="w-full p-2.5 rounded-lg bg-white border border-slate-300 text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
          />
              <button
                type="submit"
                disabled={addItem.isPending || !form.name.trim()}
                className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold disabled:opacity-50 transition"
              >
                {addItem.isPending ? t("adding") : t("addItem")}
              </button>
            </form>
          )}
        </div>

        <datalist id="supplier-options">
          {suppliers.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <div className="px-4 py-2 border-b border-slate-200">
          <button
            onClick={handleResync}
            disabled={resync.isPending}
            className="w-full py-2 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            {resync.isPending ? t("reloading") : `${t("reloadMaster")} (${SEED_COUNT})`}
          </button>
        </div>

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
            {CATEGORY_ORDER.map((c) => (
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
          {filterCat && (SUBCATEGORY_ORDER[filterCat] || []).length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              <Chip active={!filterSub} onClick={() => setFilterSub(null)}>
                {t("all")}
              </Chip>
              {(SUBCATEGORY_ORDER[filterCat] || []).map((s) => (
                <Chip key={s} active={filterSub === s} onClick={() => setFilterSub(s)}>
                  {ts(s)}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 divide-y divide-slate-100">
          {filtered.map((item) => {
            const inactive = item.active === false;
            if (editingId === item.id) {
              return (
                <div key={item.id} className="py-2">
                  <EditRow
                    item={item}
                    onCancel={() => setEditingId(null)}
                    onSave={(patch) => {
                      updateItem.mutate({ id: item.id, patch });
                      setEditingId(null);
                    }}
                  />
                </div>
              );
            }
            return (
              <div key={item.id} className={`py-2 ${inactive ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${inactive ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {ti(item.name, item)}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {tc(item.category)} · {ts(item.subCategory)} · {item.unit}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingId(item.id)}
                    className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 shrink-0"
                    aria-label={t("edit")}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
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
                    aria-label={inactive ? t("reactivate") : t("deactivate")}
                    onClick={() => setActive.mutate({ id: item.id, active: inactive })}
                    className={`relative h-6 w-11 rounded-full shrink-0 transition ${
                      inactive ? "bg-slate-300" : "bg-teal-500"
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
