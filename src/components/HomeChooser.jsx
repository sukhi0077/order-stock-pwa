// src/components/HomeChooser.jsx
import React from "react";
import { useT } from "../i18n/i18n.jsx";

// The landing screen after sign-in: two big choices.
export default function HomeChooser({ onChoose }) {
  const { t } = useT();
  return (
    <div className="max-w-md mx-auto px-2 py-8">
      <h1 className="text-2xl font-bold text-slate-900 text-center mb-1">{t("home_q")}</h1>
      <p className="text-center text-slate-500 text-sm mb-8">{t("home_sub")}</p>

      <div className="space-y-4">
        <button
          onClick={() => onChoose("orders")}
          className="w-full bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-4 hover:border-teal-300 hover:bg-teal-50/40 transition text-left"
        >
          <span className="h-14 w-14 shrink-0 grid place-items-center rounded-2xl bg-teal-600 text-white">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-bold text-slate-900">{t("placeOrder")}</span>
            <span className="block text-sm text-slate-500">{t("placeOrder_desc")}</span>
          </span>
        </button>

        <button
          onClick={() => onChoose("receive")}
          className="w-full bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-4 hover:border-teal-300 hover:bg-teal-50/40 transition text-left"
        >
          <span className="h-14 w-14 shrink-0 grid place-items-center rounded-2xl bg-blue-600 text-white">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16v6H4z" />
              <path d="M4 10v10h16V10" />
              <path d="M9 14h6" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-bold text-slate-900">{t("receive")}</span>
            <span className="block text-sm text-slate-500">{t("receive_desc")}</span>
          </span>
        </button>

        <button
          onClick={() => onChoose("stock")}
          className="w-full bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-4 hover:border-teal-300 hover:bg-teal-50/40 transition text-left"
        >
          <span className="h-14 w-14 shrink-0 grid place-items-center rounded-2xl bg-amber-500 text-white">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="m9 14 2 2 4-4" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-bold text-slate-900">{t("monthStock")}</span>
            <span className="block text-sm text-slate-500">{t("monthStock_desc")}</span>
          </span>
        </button>
      </div>
    </div>
  );
}
