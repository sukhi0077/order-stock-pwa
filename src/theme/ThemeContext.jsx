// src/theme/ThemeContext.jsx
//
// Which colour scheme the app is wearing. Stored in localStorage rather than
// sessionStorage so the choice survives closing the PWA — it is a preference,
// not navigation state.
import React, { createContext, useContext, useState, useCallback } from "react";
import { DEFAULT_THEME, THEMES, getTheme, accentVars } from "./themes.js";

// Apply a hue by writing --accent-* onto <html>.
//
// It MUST be the root element. index.css declares `--color-accent-600:
// var(--accent-600)` inside @theme, which Tailwind emits on :root — and a
// var() inside a custom property is substituted where the DECLARATION sits,
// not where it is used. So --color-accent-600 computes once, on :root, and
// descendants inherit that finished value. Setting --accent-600 on a nested
// <div> therefore changes nothing: that was the bug behind "the colours don't
// change". Writing to documentElement re-resolves it, because it is the very
// element the declaration lives on.
// Both names are written: --accent-* (what index.css seeds) and the
// --color-accent-* Tailwind actually reads. Setting the second directly means
// the result does not depend on the one-hop indirection resolving the way we
// expect — the utilities read --color-accent-* and find the new value there.
export function applyAccent(hue) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(accentVars(hue))) {
    root.style.setProperty(k, v);
    root.style.setProperty(k.replace("--accent-", "--color-accent-"), v);
  }
}

const KEY = "appTheme";
const Ctx = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      return saved && THEMES[saved] ? saved : DEFAULT_THEME;
    } catch {
      // Private mode / storage disabled — fall back rather than crash the app.
      return DEFAULT_THEME;
    }
  });

  const setTheme = useCallback((id) => {
    if (!THEMES[id]) return;
    setThemeId(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // Preference just won't persist; the session still honours it.
    }
  }, []);

  return (
    <Ctx.Provider value={{ themeId, setTheme, theme: getTheme(themeId) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const v = useContext(Ctx);
  // Falling back keeps a component usable outside the provider (tests, an
  // isolated render) instead of throwing.
  return v || { themeId: DEFAULT_THEME, setTheme: () => {}, theme: getTheme(DEFAULT_THEME) };
}
