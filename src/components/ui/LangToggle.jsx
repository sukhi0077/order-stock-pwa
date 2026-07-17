// src/components/ui/LangToggle.jsx
import React from "react";
import { useT } from "../../i18n/i18n.jsx";

// A small EN / हिं pill to switch the app language.
export default function LangToggle() {
  const { lang, setLang } = useT();
  const base = "px-2 py-1 text-xs font-semibold rounded-md transition";
  return (
    <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5">
      <button
        onClick={() => setLang("en")}
        className={`${base} ${lang === "en" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
      <button
        onClick={() => setLang("hi")}
        className={`${base} ${lang === "hi" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
        aria-pressed={lang === "hi"}
      >
        हिं
      </button>
    </div>
  );
}
