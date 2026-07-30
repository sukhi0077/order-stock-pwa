// src/theme/ThemeContext.jsx
//
// Which colour scheme the app is wearing. Stored in localStorage rather than
// sessionStorage so the choice survives closing the PWA — it is a preference,
// not navigation state.
import React, { createContext, useContext, useState, useCallback } from "react";
import { DEFAULT_THEME, THEMES, getTheme } from "./themes.js";

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
