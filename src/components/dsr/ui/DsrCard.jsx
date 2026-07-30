import React from "react";

// Each section gets its own colour so it's easy to tell cards apart: a soft
// tint with a bold left accent, matching the light chrome the rest of the app
// uses (white surfaces, slate-200 hairlines, rounded-2xl).
const COLORS = {
  blue: {
    wrap: "bg-blue-50 border-blue-200 border-l-blue-500",
    title: "text-blue-700",
  },
  green: {
    wrap: "bg-emerald-50 border-emerald-200 border-l-emerald-500",
    title: "text-emerald-700",
  },
  purple: {
    wrap: "bg-violet-50 border-violet-200 border-l-violet-500",
    title: "text-violet-700",
  },
  amber: {
    wrap: "bg-amber-50 border-amber-200 border-l-amber-500",
    title: "text-amber-700",
  },
  pink: {
    wrap: "bg-pink-50 border-pink-200 border-l-pink-500",
    title: "text-pink-700",
  },
  cyan: {
    wrap: "bg-cyan-50 border-cyan-200 border-l-cyan-500",
    title: "text-cyan-700",
  },
};

export default function Card({ title, color = "blue", children }) {
  const c = COLORS[color] || COLORS.blue;
  return (
    <div
      className={`p-4 rounded-2xl mb-4 border border-l-4 ${c.wrap}`}
    >
      <h2 className={`text-base font-bold mb-3 ${c.title}`}>{title}</h2>
      {children}
    </div>
  );
}
