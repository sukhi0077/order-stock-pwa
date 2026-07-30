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
    <div className="min-h-screen flex items-center justify-center bg-n-50 text-n-900 p-4">
      <div className="w-full max-w-sm bg-n-0 border border-n-200 rounded-2xl p-8 shadow-sm">
        <div className="flex justify-end mb-2">
          <LangToggle />
        </div>
        <h1 className="text-2xl font-bold text-center mb-1 tracking-tight text-n-900">
          {t("login_title")}
        </h1>
        <p className="text-center text-n-500 text-sm mb-6">{t("login_subtitle")}</p>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/40 text-rose-700 dark:text-rose-300 p-3 rounded-lg mb-4 text-sm text-center font-semibold">
            {t(error)}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <label className="block text-sm font-medium text-n-600 mb-2">
            {t("email")}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            className="w-full p-3 mb-4 rounded-lg bg-n-0 border border-n-300 text-n-900 outline-none focus:ring-2 focus:ring-accent-500 transition"
            placeholder="staff@yourshop.com"
          />

          <label className="block text-sm font-medium text-n-600 mb-2">
            {t("password")}
          </label>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full p-3 mb-3 rounded-lg bg-n-0 border border-n-300 text-n-900 outline-none focus:ring-2 focus:ring-accent-500 transition"
            placeholder="••••••••"
          />

          <label className="flex items-center gap-2 mb-6 text-sm text-n-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className="h-4 w-4 accent-accent-600"
            />
            {t("showPassword")}
          </label>

          <button
            type="submit"
            disabled={isBusy}
            className="w-full py-3 bg-accent-600 hover:bg-accent-500 disabled:bg-n-200 disabled:text-n-400 text-white font-bold rounded-xl transition"
          >
            {isBusy ? t("signingIn") : t("signIn")}
          </button>
        </form>
      </div>
    </div>
  );
}
