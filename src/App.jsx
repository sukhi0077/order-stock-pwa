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
  const receiveTheme = !showAdmin && mode === "receive";
  const stockTheme = !showAdmin && mode === "stock";
  // Daily Sale Report gets a pink accent, matching its home tile — same light
  // chrome pattern as receive (blue) and stock (amber).
  const dsrTheme = !showAdmin && mode === "dsr";
  const coloredHeader = showAdmin || receiveTheme || stockTheme || dsrTheme;
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
        showAdmin
          ? "bg-indigo-50"
          : receiveTheme
            ? "bg-blue-50"
            : stockTheme
              ? "bg-amber-50"
              : dsrTheme
                ? "bg-pink-50"
                : "bg-slate-50"
      }`}
    >
      {(!isOnline || pending > 0) && (
        <div
          className={`fixed top-0 left-0 w-full z-[60] text-center text-xs font-semibold py-1.5 ${
            !isOnline ? "bg-amber-500 text-white" : "bg-teal-600 text-white"
          }`}
        >
          {!isOnline
            ? `${t("offline")}${pending > 0 ? " " + t("offlineTail", { n: pending }) : ""}`
            : t("syncing", { n: pending })}
        </div>
      )}

      <header
        className={`sticky top-0 z-50 backdrop-blur border-b ${
          showAdmin
            ? "bg-indigo-600 border-indigo-700"
            : receiveTheme
              ? "bg-blue-600 border-blue-700"
              : stockTheme
                ? "bg-amber-500 border-amber-600"
                : dsrTheme
                  ? "bg-pink-600 border-pink-700"
                  : "bg-white/90 border-slate-200"
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
                {showAdmin ? t("countApp") : t("admin")}
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
          {/* Coming from the DSR tile opens the dashboard on its DSR tab. */}
          <AdminDashboard
            reporter={reporter}
            initialTab={mode === "dsr" ? "dsr" : "orders"}
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
