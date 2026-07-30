// src/components/ui/LangToggle.jsx
import React from "react";
import { useT } from "../../i18n/i18n.jsx";

// A small EN / हिं pill to switch the app language.
export default function LangToggle() {
  const { lang, setLang } = useT();
  const base = "px-2 py-1 text-xs font-semibold rounded-md transition";
  return (
    <div className="flex items-center gap-0.5 bg-n-100 border border-n-200 rounded-lg p-0.5">
      <button
        onClick={() => setLang("en")}
        className={`${base} ${lang === "en" ? "bg-n-0 text-n-900 shadow-sm" : "text-n-500"}`}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
      <button
        onClick={() => setLang("hi")}
        className={`${base} ${lang === "hi" ? "bg-n-0 text-n-900 shadow-sm" : "text-n-500"}`}
        aria-pressed={lang === "hi"}
      >
        हिं
      </button>
    </div>
  );
}
