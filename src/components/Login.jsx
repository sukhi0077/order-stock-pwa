// src/components/Login.jsx
import React, { useState } from "react";
import { useT } from "../i18n/i18n.jsx";
import LangToggle from "./ui/LangToggle.jsx";

const errorKey = (code) => {
  switch (code) {
    case "auth/invalid-email":
      return "err_invalid_email";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "err_bad_credential";
    case "auth/too-many-requests":
      return "err_too_many";
    case "auth/network-request-failed":
      return "err_network";
    default:
      return "err_generic";
  }
};

export default function Login({ onLogin }) {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("err_both");
      return;
    }
    setIsBusy(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(errorKey(err?.code));
      setIsBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <div className="flex justify-end mb-2">
          <LangToggle />
        </div>
        <h1 className="text-2xl font-bold text-center mb-1 tracking-tight text-slate-900">
          {t("login_title")}
        </h1>
        <p className="text-center text-slate-500 text-sm mb-6">{t("login_subtitle")}</p>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg mb-4 text-sm text-center font-semibold">
            {t(error)}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            {t("email")}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            className="w-full p-3 mb-4 rounded-lg bg-white border border-slate-300 text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 transition"
            placeholder="staff@yourshop.com"
          />

          <label className="block text-sm font-medium text-slate-600 mb-2">
            {t("password")}
          </label>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full p-3 mb-3 rounded-lg bg-white border border-slate-300 text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 transition"
            placeholder="••••••••"
          />

          <label className="flex items-center gap-2 mb-6 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className="h-4 w-4 accent-teal-600"
            />
            {t("showPassword")}
          </label>

          <button
            type="submit"
            disabled={isBusy}
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl transition"
          >
            {isBusy ? t("signingIn") : t("signIn")}
          </button>
        </form>
      </div>
    </div>
  );
}
