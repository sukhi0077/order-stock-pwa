// src/App.jsx
import React, { useState, Suspense, lazy } from "react";
import StaffPanel from "./components/StaffPanel.jsx";
import OrderPanel from "./components/OrderPanel.jsx";
import ReceivePanel from "./components/ReceivePanel.jsx";
import HomeChooser from "./components/HomeChooser.jsx";
import Login from "./components/Login.jsx";
import Spinner from "./components/ui/Spinner.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { useOfflineSync } from "./hooks/useOfflineSync.js";
import { useBusinessDay } from "./hooks/useBusinessDay.js";
import { useT } from "./i18n/i18n.jsx";
import LangToggle from "./components/ui/LangToggle.jsx";
import { useTheme } from "./theme/ThemeContext.jsx";
import { accentVars } from "./theme/themes.js";

const AdminDashboard = lazy(() => import("./components/AdminDashboard.jsx"));
// The Daily Sale Report is a big, self-contained screen — load it only when
// someone actually opens the tile.
const DsrPanel = lazy(() => import("./components/dsr/DsrPanel.jsx"));

export default function App() {
  const { user, isAdmin, isAuthLoading, adminError, login, logout } = useAuth();
  const { pending, isOnline } = useOfflineSync();
  // Warsaw business date — used to remount the DSR panel at midnight.
  const businessDay = useBusinessDay();
  const { t } = useT();
  const { theme } = useTheme();

  const [isAdminView, setIsAdminView] = useState(
    () => sessionStorage.getItem("isAdminView") === "true",
  );
  // Landing: 'home' | 'orders' | 'receive' | 'stock' | 'dsr'
  const [mode, setMode] = useState(() => sessionStorage.getItem("appMode") || "home");

  const chooseMode = (m) => {
    setMode(m);
    sessionStorage.setItem("appMode", m);
  };

  const toggleView = () => {
    const next = !isAdminView;
    setIsAdminView(next);
    sessionStorage.setItem("isAdminView", next);
    // Leaving admin always lands on the staff home screen. Staying on whatever
    // tile you were last on was disorienting — you tap StaffMode to step back
    // out, not to resume a half-finished task.
    if (!next) chooseMode("home");
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner />
      </div>
    );
  }

  if (!user) return <Login onLogin={login} />;

  const reporter = user.email || user.uid;
  const showAdmin = isAdmin && isAdminView;
  // Which section's chrome to wear. Colours come from the user's chosen scheme
  // (see src/theme/themes.js) rather than being hard-coded here, so switching
  // schemes restyles the whole app. Home and Orders keep the plain white
  // header, hence coloredHeader.
  const section = showAdmin ? "admin" : mode === "home" ? "orders" : mode;
  const sec = theme[section] || theme.orders;
  // Every accent-* utility in the app resolves through these variables, so one
  // assignment here recolours every page for the chosen scheme.
  const accent = accentVars(sec.hue);
  const coloredHeader = !sec.plainHeader;
  const showHomeBtn = !showAdmin && mode !== "home";
  const colBtn = coloredHeader
    ? "bg-white/20 border-white/30 text-white hover:bg-white/30"
    : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900";

  const title = showAdmin
    ? t("admin")
    : mode === "dsr"
      ? t("dsr")
      : mode === "orders"
      ? t("placeOrder")
      : mode === "stock"
        ? t("monthStock")
        : mode === "receive"
          ? t("receive")
          : t("appName");

  return (
    <div
      className={`min-h-screen font-sans text-slate-900 ${
        sec.plainHeader ? "bg-slate-50" : "bg-accent-50"
      }`}
      style={accent}
    >
      {(!isOnline || pending > 0) && (
        <div
          className={`fixed top-0 left-0 w-full z-[60] text-center text-xs font-semibold py-1.5 ${
            !isOnline ? "bg-amber-500 text-white" : "bg-accent-600 text-white"
          }`}
        >
          {!isOnline
            ? `${t("offline")}${pending > 0 ? " " + t("offlineTail", { n: pending }) : ""}`
            : t("syncing", { n: pending })}
        </div>
      )}

      <header
        className={`sticky top-0 z-50 backdrop-blur border-b ${
          sec.plainHeader ? "bg-white/90 border-slate-200" : "bg-accent-600 border-accent-700"
        }`}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {showHomeBtn && (
              <button
                onClick={() => chooseMode("home")}
                className={`h-8 w-8 grid place-items-center rounded-lg border ${colBtn}`}
                aria-label="home"
              >
                ‹
              </button>
            )}
            {showAdmin && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-white shrink-0" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            )}
            <span
              className={`font-bold tracking-tight truncate ${coloredHeader ? "text-white" : "text-slate-900"}`}
            >
              {title}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LangToggle />
            {isAdmin && (
              <button
                onClick={toggleView}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${colBtn}`}
              >
                {/* Labels name the destination, not the current view: in admin
                    you tap StaffMode to leave, and vice versa. */}
                {showAdmin ? t("staffMode") : t("adminMode")}
              </button>
            )}
            <button
              onClick={logout}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                coloredHeader ? colBtn : "bg-slate-100 border-slate-200 text-rose-600 hover:text-rose-700"
              }`}
            >
              {t("signOut")}
            </button>
          </div>
        </div>
      </header>

      {showAdmin ? (
        <Suspense
          fallback={
            <div className="min-h-[60vh] flex items-center justify-center">
              <Spinner label="Loading dashboard…" />
            </div>
          }
        >
          {/* DSR leads the dashboard; arriving from the Orders tile opens Orders. */}
          <AdminDashboard
            reporter={reporter}
            initialTab={mode === "orders" ? "orders" : "dsr"}
          />
        </Suspense>
      ) : (
        <div className="p-4 max-w-2xl mx-auto">
          {mode === "home" && <HomeChooser onChoose={chooseMode} />}
          {mode === "stock" && <StaffPanel reporter={reporter} isOnline={isOnline} />}
          {mode === "orders" && <OrderPanel reporter={reporter} />}
          {mode === "receive" && <ReceivePanel reporter={reporter} />}
          {mode === "dsr" && (
            <Suspense
              fallback={
                <div className="min-h-[60vh] flex items-center justify-center">
                  <Spinner label="Loading report…" />
                </div>
              }
            >
              {/* key: remount when the business day rolls over, so a phone
                  left open overnight resets to a blank form for the new day. */}
              <DsrPanel key={businessDay} />
            </Suspense>
          )}
        </div>
      )}

      {/* TEMP DEBUG — remove once admin access works. */}
      <div className="fixed bottom-1 left-1 z-[60] px-2 py-1 rounded bg-slate-900/80 text-[10px] font-mono text-slate-200 select-all max-w-[95vw] break-words">
        uid: {user.uid} · admin: {isAdmin ? "YES" : "no"}
        {adminError && <div className="text-rose-300 mt-0.5">profile: {adminError}</div>}
      </div>
    </div>
  );
}
