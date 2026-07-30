// src/theme/themes.js
//
// Three colour schemes the user can pick from on the home screen.
//
// Each scheme gives every SECTION of the app (orders / receive / stock / dsr /
// admin) a hue, expressed as complete Tailwind class strings rather than a
// colour name. That is deliberate: Tailwind compiles by scanning source text,
// so `bg-${hue}-600` would never be generated. Every class below appears
// literally, so it survives the build.
//
// Amber, orange, red and pink are reserved for warning / error states and are
// used here only where the section itself is amber in the Classic scheme.

// One section's chrome: solid header, tinted page background, home-tile icon.
const make = (header, headerBorder, surface, tile, hoverBorder, hoverBg) => ({
  header: `${header} ${headerBorder}`,
  surface,
  tile,
  hoverBorder,
  hoverBg,
});

export const THEMES = {
  classic: {
    id: "classic",
    label: "Classic",
    // Swatches shown in the picker, in section order.
    swatches: ["bg-teal-600", "bg-blue-600", "bg-amber-500", "bg-violet-600"],
    orders: make("bg-white/90", "border-slate-200", "bg-slate-50", "bg-teal-600", "hover:border-teal-300", "hover:bg-teal-50/40"),
    receive: make("bg-blue-600", "border-blue-700", "bg-blue-50", "bg-blue-600", "hover:border-blue-300", "hover:bg-blue-50/40"),
    stock: make("bg-amber-500", "border-amber-600", "bg-amber-50", "bg-amber-500", "hover:border-amber-300", "hover:bg-amber-50/40"),
    dsr: make("bg-violet-600", "border-violet-700", "bg-violet-50", "bg-violet-600", "hover:border-violet-300", "hover:bg-violet-50/40"),
    admin: make("bg-indigo-600", "border-indigo-700", "bg-indigo-50", "bg-indigo-600", "hover:border-indigo-300", "hover:bg-indigo-50/40"),
  },

  ocean: {
    id: "ocean",
    label: "Ocean",
    swatches: ["bg-teal-600", "bg-sky-600", "bg-cyan-700", "bg-indigo-600"],
    orders: make("bg-white/90", "border-slate-200", "bg-slate-50", "bg-teal-600", "hover:border-teal-300", "hover:bg-teal-50/40"),
    receive: make("bg-sky-600", "border-sky-700", "bg-sky-50", "bg-sky-600", "hover:border-sky-300", "hover:bg-sky-50/40"),
    stock: make("bg-cyan-700", "border-cyan-800", "bg-cyan-50", "bg-cyan-700", "hover:border-cyan-300", "hover:bg-cyan-50/40"),
    dsr: make("bg-indigo-600", "border-indigo-700", "bg-indigo-50", "bg-indigo-600", "hover:border-indigo-300", "hover:bg-indigo-50/40"),
    admin: make("bg-slate-700", "border-slate-800", "bg-slate-100", "bg-slate-700", "hover:border-slate-400", "hover:bg-slate-100"),
  },

  // Monochrome: one hue, sections separated by weight rather than colour.
  // Nothing here can be mistaken for a status colour.
  graphite: {
    id: "graphite",
    label: "Graphite",
    swatches: ["bg-slate-900", "bg-slate-700", "bg-slate-500", "bg-slate-400"],
    orders: make("bg-white/90", "border-slate-200", "bg-slate-50", "bg-slate-900", "hover:border-slate-400", "hover:bg-slate-100"),
    receive: make("bg-slate-700", "border-slate-800", "bg-slate-100", "bg-slate-700", "hover:border-slate-400", "hover:bg-slate-100"),
    stock: make("bg-slate-500", "border-slate-600", "bg-slate-100", "bg-slate-500", "hover:border-slate-400", "hover:bg-slate-100"),
    dsr: make("bg-slate-800", "border-slate-900", "bg-slate-100", "bg-slate-800", "hover:border-slate-400", "hover:bg-slate-100"),
    admin: make("bg-slate-900", "border-black", "bg-slate-100", "bg-slate-900", "hover:border-slate-400", "hover:bg-slate-100"),
  },
};

export const THEME_IDS = Object.keys(THEMES);
export const DEFAULT_THEME = "classic";

export function getTheme(id) {
  return THEMES[id] || THEMES[DEFAULT_THEME];
}
