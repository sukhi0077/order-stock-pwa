// src/components/HomeChooser.jsx
import React from "react";
import { useT } from "../i18n/i18n.jsx";
import { useTheme } from "../theme/ThemeContext.jsx";
import { THEMES, swatchesFor, hueHex, neutralVars } from "../theme/themes.js";

const ICONS = {
  dsr: (
    <>
      <path d="M3 3v18h18" />
      <path d="m7 14 3-4 3 3 5-6" />
      <circle cx="18" cy="7" r="1" />
    </>
  ),
  orders: (
    <>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </>
  ),
  receive: (
    <>
      <path d="M4 4h16v6H4z" />
      <path d="M4 10v10h16V10" />
      <path d="M9 14h6" />
    </>
  ),
  timesheet: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  stock: (
    <>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="m9 14 2 2 4-4" />
    </>
  ),
};

// Each tile wears ITS OWN section's hue, so the four colours here are the four
// you will meet inside the app. The icon is coloured inline rather than with an
// accent-* class: those resolve against :root, so a per-tile override of the
// accent variables would be ignored.
function Tile({ mode, title, desc, onChoose, hue }) {
  return (
    <button
      onClick={() => onChoose(mode)}
      className="w-full bg-n-0 border border-n-200 rounded-2xl p-6 flex items-center gap-4 transition text-left hover:border-accent-300 hover:bg-accent-50 dark:hover:bg-accent-900/20"
    >
      <span
        className="h-14 w-14 shrink-0 grid place-items-center rounded-2xl text-white"
        style={{ backgroundColor: hueHex(hue) }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ICONS[mode]}
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-bold text-n-900">{title}</span>
        <span className="block text-sm text-n-500">{desc}</span>
      </span>
    </button>
  );
}

// Pick one of the colour schemes. Sits at the bottom of the home screen: it is
// a preference you set once, not something to step over on the way to work.
function ThemePicker() {
  const { t } = useT();
  const { themeId, setTheme } = useTheme();
  return (
    <div className="mt-10">
      <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-n-400 mb-2">
        {t("colourScheme")}
      </p>
      <div className="flex justify-center gap-2">
        {Object.values(THEMES).map((th) => {
          const on = th.id === themeId;
          return (
            <button
              key={th.id}
              type="button"
              onClick={() => setTheme(th.id)}
              aria-pressed={on}
              className={`flex-1 max-w-[9rem] rounded-xl border px-3 py-2.5 transition ${
                on
                  ? "border-n-900 bg-n-0 shadow-sm"
                  : "border-n-200 bg-n-0 hover:border-n-400"
              }`}
            >
              {/* Dark schemes preview their actual page colour behind the
                  dots, so the picker shows that the whole app changes and not
                  just the hues. */}
              <span
                className="flex justify-center gap-1 mb-1.5 rounded-md py-1"
                style={
                  th.neutrals === "dark"
                    ? { backgroundColor: neutralVars("dark")["--n-50"] }
                    : undefined
                }
              >
                {swatchesFor(th).map((hex, i) => (
                  <span
                    key={i}
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </span>
              <span
                className={`block text-xs font-semibold ${
                  on ? "text-n-900" : "text-n-500"
                }`}
              >
                {th.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// The landing screen after sign-in. Daily Sale Report leads: it is the one job
// that has to happen every single day.
export default function HomeChooser({ onChoose }) {
  const { t } = useT();
  const { theme } = useTheme();

  const tiles = [
    ["dsr", t("dsr"), t("dsr_desc")],
    ["orders", t("placeOrder"), t("placeOrder_desc")],
    ["receive", t("receive"), t("receive_desc")],
    ["stock", t("monthStock"), t("monthStock_desc")],
    ["timesheet", t("timesheet"), t("timesheet_desc")],
  ];

  return (
    <div className="max-w-md mx-auto px-2 py-8">
      <h1 className="text-2xl font-bold text-n-900 text-center mb-1">{t("home_q")}</h1>
      <p className="text-center text-n-500 text-sm mb-8">{t("home_sub")}</p>

      <div className="space-y-4">
        {tiles.map(([mode, title, desc]) => (
          <Tile
            key={mode}
            mode={mode}
            title={title}
            desc={desc}
            onChoose={onChoose}
            hue={theme[mode].hue}
          />
        ))}
      </div>

      <ThemePicker />
    </div>
  );
}
