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
  emerald:["#ecfdf5","#d1fae5","#a7f3d0","#6ee7b7","#34d399","#10b981","#059669","#047857","#065f46","#064e3b"],
  slate:  ["#f8fafc","#f1f5f9","#e2e8f0","#cbd5e1","#94a3b8","#64748b","#475569","#334155","#1e293b","#0f172a"],
};
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

// NEUTRALS — surfaces, borders and text.
//
// The app used bg-white / text-slate-900 / border-slate-200 directly, which is
// why a scheme could only ever recolour accents. Those are now n-0..n-900, fed
// by --n-* variables, so a scheme controls the whole page.
//
// n-0 is the CARD surface and n-50 the page behind it; n-900 is primary text.
// A dark scheme is then just this ramp read from the other end — no component
// needs a dark: variant.
const NEUTRALS = {
  light: {
    0: "#ffffff", 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1",
    400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155",
    800: "#1e293b", 900: "#0f172a",
  },
  // Lifted from the standalone dsr-pwa, so Midnight is that app's palette
  // exactly. Checked against its markup rather than guessed:
  //   App shell  bg-slate-900  -> the PAGE
  //   cards      bg-slate-800  -> the CARD surface
  //   borders    border-slate-700 (57 uses, the dominant hairline)
  //   body text  text-slate-300 (56 uses), headings text-slate-100
  // Note the page is slate-900 and cards sit LIGHTER on top of it, which is
  // the opposite of the light ramp — hence n-0 being lighter than n-50 here.
  dark: {
    0: "#1e293b",   // slate-800 — card surface
    50: "#0f172a",  // slate-900 — the page behind the cards
    100: "#334155", // slate-700 — chip tracks, nested rows
    200: "#334155", // slate-700 — hairlines
    300: "#475569", // slate-600 — stronger borders, inputs
    400: "#64748b", // slate-500 — dimmest text
    500: "#94a3b8", // slate-400 — secondary text
    600: "#cbd5e1", // slate-300 — body text
    700: "#cbd5e1", // slate-300 — body text
    800: "#e2e8f0", // slate-200
    900: "#f1f5f9", // slate-100 — headings
  },
};
const N_SHADES = [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

export function neutralVars(mode) {
  const ramp = NEUTRALS[mode] || NEUTRALS.light;
  return Object.fromEntries(N_SHADES.map((s) => [`--n-${s}`, ramp[s]]));
}

// The --accent-* custom properties for one hue, ready for a style attribute.
export function accentVars(hue) {
  const ramp = RAMPS[hue] || RAMPS.teal;
  return Object.fromEntries(SHADES.map((s, i) => [`--accent-${s}`, ramp[i]]));
}

// A section is just its hue. The plain white header belongs to the home screen
// alone and is decided in App, not here — it is a property of that one screen,
// not of any section.
const S = (hue) => ({ hue });

export const THEMES = {
  classic: {
    id: "classic",
    label: "Classic",
    neutrals: "light",
    orders: S("teal"),
    receive: S("blue"),
    stock: S("amber"),
    dsr: S("violet"),
    timesheet: S("sky"),
    admin: S("indigo"),
  },
  ocean: {
    id: "ocean",
    label: "Ocean",
    neutrals: "light",
    orders: S("teal"),
    receive: S("sky"),
    stock: S("cyan"),
    dsr: S("indigo"),
    timesheet: S("teal"),
    admin: S("slate"),
  },
  // The only scheme that flips the neutral ramp. Every surface and text colour
  // comes from n-*, so nothing else has to change to make the app dark.
  // Accents are the DSR-era hues, kept off amber/pink so nothing reads as a
  // warning on a dark card.
  midnight: {
    id: "midnight",
    label: "Midnight",
    neutrals: "dark",
    // dsr-pwa's own accents: blue-600 for primary actions, with emerald /
    // violet / cyan alongside it on the section cards.
    orders: S("emerald"),
    receive: S("blue"),
    stock: S("cyan"),
    dsr: S("violet"),
    timesheet: S("sky"),
    admin: S("indigo"),
  },
};

// Swatches for the picker: one dot per section, in home-tile order.
export const SECTIONS = ["dsr", "orders", "receive", "stock", "timesheet"];
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
