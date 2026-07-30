import React from "react";

// Each section gets its own colour so it's easy to tell cards apart.
// Backgrounds are kept as soft tints (with a bold left accent) so the
// dark-theme inputs inside stay readable.
const COLORS = {
  blue: {
    wrap: "bg-blue-900/20 border-blue-700/40 border-l-blue-500",
    title: "text-blue-300",
  },
  green: {
    wrap: "bg-emerald-900/20 border-emerald-700/40 border-l-emerald-500",
    title: "text-emerald-300",
  },
  purple: {
    wrap: "bg-violet-900/20 border-violet-700/40 border-l-violet-500",
    title: "text-violet-300",
  },
  amber: {
    wrap: "bg-amber-900/20 border-amber-700/40 border-l-amber-500",
    title: "text-amber-300",
  },
  pink: {
    wrap: "bg-pink-900/20 border-pink-700/40 border-l-pink-500",
    title: "text-pink-300",
  },
  cyan: {
    wrap: "bg-cyan-900/20 border-cyan-700/40 border-l-cyan-500",
    title: "text-cyan-300",
  },
};

export default function Card({ title, color = "blue", children }) {
  const c = COLORS[color] || COLORS.blue;
  return (
    <div
      className={`p-4 rounded-xl shadow-lg mb-4 border border-l-4 ${c.wrap}`}
    >
      <h2 className={`text-xl font-semibold mb-4 ${c.title}`}>{title}</h2>
      {children}
    </div>
  );
}
