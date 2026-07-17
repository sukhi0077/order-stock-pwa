// src/components/ui/Card.jsx
import React from "react";

export default function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-slate-800 border border-slate-700 rounded-2xl p-4 md:p-5 shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}
