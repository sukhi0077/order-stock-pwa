import React from "react";

// Each section of the daily report gets its own colour so the cards are easy to
// tell apart — "Report finansowy", "Portal sales" and so on.
//
// Amber, orange and pink are deliberately absent: those read as warning /
// error everywhere else in the app, and a decorative amber card was being
// mistaken for a caution.
//
// Two recipes, not one tint dimmed. On a light page a card is a pale wash with
// dark text; on the dark page it is a deep translucent wash with LIGHT text.
// The dark strings are lifted verbatim from the standalone dsr-pwa, so
// Midnight reproduces that app rather than approximating it:
//     bg-<hue>-900/20  border-<hue>-700/40  border-l-<hue>-500  text-<hue>-300
const COLORS = {
  blue: {
    wrap: "bg-blue-50 border-blue-200 border-l-blue-500 dark:bg-blue-900/20 dark:border-blue-700/40 dark:border-l-blue-500",
    title: "text-blue-700 dark:text-blue-300",
  },
  green: {
    wrap: "bg-emerald-50 border-emerald-200 border-l-emerald-500 dark:bg-emerald-900/20 dark:border-emerald-700/40 dark:border-l-emerald-500",
    title: "text-emerald-700 dark:text-emerald-300",
  },
  purple: {
    wrap: "bg-violet-50 border-violet-200 border-l-violet-500 dark:bg-violet-900/20 dark:border-violet-700/40 dark:border-l-violet-500",
    title: "text-violet-700 dark:text-violet-300",
  },
  // These two keep dsr-pwa's names because that is the colour they wear on the
  // dark scheme. On the LIGHT scheme they substitute a different hue: a pale
  // amber card was being read as a caution, and pink sat too close to the error
  // red. Neither confusion exists at bg-<hue>-900/20 with <hue>-300 text on a
  // slate-900 page, so Midnight keeps the originals.
  amber: {
    wrap: "bg-teal-50 border-teal-200 border-l-teal-500 dark:bg-amber-900/20 dark:border-amber-700/40 dark:border-l-amber-500",
    title: "text-teal-700 dark:text-amber-300",
  },
  pink: {
    wrap: "bg-indigo-50 border-indigo-200 border-l-indigo-500 dark:bg-pink-900/20 dark:border-pink-700/40 dark:border-l-pink-500",
    title: "text-indigo-700 dark:text-pink-300",
  },
  cyan: {
    wrap: "bg-cyan-50 border-cyan-200 border-l-cyan-500 dark:bg-cyan-900/20 dark:border-cyan-700/40 dark:border-l-cyan-500",
    title: "text-cyan-700 dark:text-cyan-300",
  },
};

export default function Card({ title, color = "blue", children }) {
  const c = COLORS[color] || COLORS.blue;
  return (
    <div className={`p-4 rounded-2xl mb-4 border border-l-4 ${c.wrap}`}>
      <h2 className={`text-base font-bold mb-3 ${c.title}`}>{title}</h2>
      {children}
    </div>
  );
}
