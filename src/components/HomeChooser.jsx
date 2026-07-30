// src/components/HomeChooser.jsx
import React from "react";
import { useT } from "../i18n/i18n.jsx";
import { useTheme } from "../theme/ThemeContext.jsx";
import { THEMES } from "../theme/themes.js";

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
  stock: (
    <>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="m9 14 2 2 4-4" />
    </>
  ),
};

function Tile({ mode, title, desc, onChoose, sec }) {
  return (
    <button
      onClick={() => onChoose(mode)}
      className={`w-full bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-4 transition text-left ${sec.hoverBorder} ${sec.hoverBg}`}
    >
      <span
        className={`h-14 w-14 shrink-0 grid place-items-center rounded-2xl text-white ${sec.tile}`}
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
        <span className="block text-lg font-bold text-slate-900">{title}</span>
        <span className="block text-sm text-slate-500">{desc}</span>
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
      <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
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
                  ? "border-slate-900 bg-white shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-400"
              }`}
            >
              <span className="flex justify-center gap-1 mb-1.5">
                {th.swatches.map((sw, i) => (
                  <span key={i} className={`h-3.5 w-3.5 rounded-full ${sw}`} />
                ))}
              </span>
              <span
                className={`block text-xs font-semibold ${
                  on ? "text-slate-900" : "text-slate-500"
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
  ];

  return (
    <div className="max-w-md mx-auto px-2 py-8">
      <h1 className="text-2xl font-bold text-slate-900 text-center mb-1">{t("home_q")}</h1>
      <p className="text-center text-slate-500 text-sm mb-8">{t("home_sub")}</p>

      <div className="space-y-4">
        {tiles.map(([mode, title, desc]) => (
          <Tile
            key={mode}
            mode={mode}
            title={title}
            desc={desc}
            onChoose={onChoose}
            sec={theme[mode]}
          />
        ))}
      </div>

      <ThemePicker />
    </div>
  );
}
