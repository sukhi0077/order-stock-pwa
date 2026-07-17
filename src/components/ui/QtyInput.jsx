// src/components/ui/QtyInput.jsx
import React from "react";

// A compact numeric input for quantities. Shows an empty box for 0 so the
// month starts visually clean, and reports back a numeric string on change.
export default function QtyInput({ value, onChange, disabled, label, accent }) {
  const display = value === 0 || value === "0" ? "" : value;
  const ring = accent
    ? "focus:ring-sky-500 border-slate-600"
    : "focus:ring-sky-500 border-slate-600";
  return (
    <label className="flex flex-col gap-1">
      {label && (
        <span className="text-[10px] uppercase tracking-wide text-slate-400">
          {label}
        </span>
      )}
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        disabled={disabled}
        value={display}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className={`w-full text-center py-2 px-1 rounded-lg bg-slate-900 border ${ring} text-slate-100 outline-none focus:ring-2 disabled:opacity-50 disabled:bg-slate-800 transition`}
      />
    </label>
  );
}
