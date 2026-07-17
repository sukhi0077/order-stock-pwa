// src/components/MonthDetailsModal.jsx
import React, { useMemo } from "react";
import { isCounted, num, summarizeClosings } from "../models/StockCountModel.js";
import { CATEGORY_ORDER } from "../data/seedItems.js";
import { useT } from "../i18n/i18n.jsx";

// Read-only breakdown of a saved month's closing counts, grouped by category.
export default function MonthDetailsModal({ monthId, items, counts, onClose }) {
  const { t, tc, ti, tMonth } = useT();
  const summary = useMemo(
    () => summarizeClosings(items, counts || {}),
    [items, counts],
  );

  const rowsByCat = useMemo(() => {
    const g = {};
    for (const item of items) {
      const v = counts?.[item.id];
      if (!isCounted(v)) continue;
      const cat = item.category || "Uncategorized";
      g[cat] = g[cat] || [];
      g[cat].push({ item, closing: num(v) });
    }
    return g;
  }, [items, counts]);

  const cats = [
    ...CATEGORY_ORDER.filter((c) => rowsByCat[c]),
    ...Object.keys(rowsByCat).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/40 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 w-full md:max-w-2xl max-h-[90vh] rounded-t-2xl md:rounded-2xl flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="font-bold text-slate-900">
            {t("closingCountsTitle", { month: tMonth(monthId) })}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none px-2"
          >
            ×
          </button>
        </div>

        <div className="px-4 py-3 flex items-center gap-6 border-b border-slate-200">
          <Stat label={t("counted")} value={summary.counted} />
          <Stat label={t("remaining")} value={summary.remaining} />
          <Stat label={t("items")} value={summary.totalItems} />
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-4">
          {cats.length === 0 && (
            <p className="text-slate-500 text-center py-6">{t("noClosing")}</p>
          )}
          {cats.map((cat) => (
            <div key={cat}>
              <h4 className="text-sm font-bold text-teal-700 mb-1">{tc(cat)}</h4>
              <table className="w-full text-sm">
                <tbody>
                  {rowsByCat[cat].map(({ item, closing }) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="py-1.5 pr-2 text-slate-700">{ti(item.name, item)}</td>
                      <td className="py-1.5 px-1 text-right text-slate-900 font-semibold w-20">
                        {closing}
                      </td>
                      <td className="py-1.5 pl-1 text-left text-slate-400 w-12 text-xs">
                        {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
