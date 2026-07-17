// src/components/ui/Spinner.jsx
import React from "react";

export default function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center gap-3 text-slate-500">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-teal-500" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
