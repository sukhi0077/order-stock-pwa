// src/theme/themes.js
//
// Three colour schemes the user can pick from on the home screen.
//
// A scheme assigns a HUE to each section of the app (orders / receive / stock /
// dsr / admin). At runtime the active section's hue is written to the
// --accent-* CSS variables on the app root, and every component styles itself
// with Tailwind's accent-* utilities (see the @theme block in index.css). That
// is why switching scheme recolours every page rather than just the header:
// nothing downstream names a hue.
//
// Status colours are NOT part of a scheme. red / rose mean error, amber means
// warning, emerald means success — those stay fixed so they keep their meaning.

// Tailwind palette ramps, as plain hex so they can go straight into a style
// attribute. Only the hues the schemes actually use are listed.
const RAMPS = {
  teal:   ["#f0fdfa","#ccfbf1","#99f6e4","#5eead4","#2dd4bf","#14b8a6","#0d9488","#0f766e","#115e59","#134e4a"],
  blue:   ["#eff6ff","#dbeafe","#bfdbfe","#93c5fd","#60a5fa","#3b82f6","#2563eb","#1d4ed8","#1e40af","#1e3a8a"],
  amber:  ["#fffbeb","#fef3c7","#fde68a","#fcd34d","#fbbf24","#f59e0b","#d97706","#b45309","#92400e","#78350f"],
  violet: ["#f5f3ff","#ede9fe","#ddd6fe","#c4b5fd","#a78bfa","#8b5cf6","#7c3aed","#6d28d9","#5b21b6","#4c1d95"],
  indigo: ["#eef2ff","#e0e7ff","#c7d2fe","#a5b4fc","#818cf8","#6366f1","#4f46e5","#4338ca","#3730a3","#312e81"],
  sky:    ["#f0f9ff","#e0f2fe","#bae6fd","#7dd3fc","#38bdf8","#0ea5e9","#0284c7","#0369a1","#075985","#0c4a6e"],
  cyan:   ["#ecfeff","#cffafe","#a5f3fc","#67e8f9","#22d3ee","#06b6d4","#0891b2","#0e7490","#155e75","#164e63"],
  slate:  ["#f8fafc","#f1f5f9","#e2e8f0","#cbd5e1","#94a3b8","#64748b","#475569","#334155","#1e293b","#0f172a"],
};
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

// The --accent-* custom properties for one hue, ready for a style attribute.
export function accentVars(hue) {
  const ramp = RAMPS[hue] || RAMPS.teal;
  return Object.fromEntries(SHADES.map((s, i) => [`--accent-${s}`, ramp[i]]));
}

// `plainHeader` keeps the white header on the two screens that have always had
// it (home and the order builder); everywhere else the header takes the accent.
const S = (hue, plainHeader = false) => ({ hue, plainHeader });

export const THEMES = {
  classic: {
    id: "classic",
    label: "Classic",
    orders: S("teal", true),
    receive: S("blue"),
    stock: S("amber"),
    dsr: S("violet"),
    admin: S("indigo"),
  },
  ocean: {
    id: "ocean",
    label: "Ocean",
    orders: S("teal", true),
    receive: S("sky"),
    stock: S("cyan"),
    dsr: S("indigo"),
    admin: S("slate"),
  },
  // Monochrome: sections separated by weight rather than hue. Nothing in this
  // scheme can be mistaken for a status colour.
  graphite: {
    id: "graphite",
    label: "Graphite",
    orders: S("slate", true),
    receive: S("slate"),
    stock: S("slate"),
    dsr: S("slate"),
    admin: S("slate"),
  },
};

// Swatches for the picker: one dot per section, in home-tile order.
export const SECTIONS = ["dsr", "orders", "receive", "stock"];
export function swatchesFor(theme) {
  return SECTIONS.map((s) => (RAMPS[theme[s].hue] || RAMPS.teal)[6]);
}

// One shade of a hue as a hex string. For the rare element that must show a
// hue OTHER than the active section's (the home tiles), where the accent-*
// utilities cannot help: they resolve on :root, so a local override is ignored.
export function hueHex(hue, shade = 600) {
  const ramp = RAMPS[hue] || RAMPS.teal;
  return ramp[Math.max(0, SHADES.indexOf(shade))];
}

export const DEFAULT_THEME = "classic";
export function getTheme(id) {
  return THEMES[id] || THEMES[DEFAULT_THEME];
}
