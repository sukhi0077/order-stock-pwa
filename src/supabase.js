// src/supabase.js
// Single Supabase client for the whole app.
//
// The URL + PUBLISHABLE key come from environment variables. They are SAFE to
// ship in the frontend BECAUSE Row-Level Security is configured (see
// supabase/schema.sql) — the publishable key can only do what RLS allows.
//
// Supabase now uses "publishable" keys (sb_publishable_...) for client/browser
// code. These replace the legacy "anon public" JWT key (being retired by end of
// 2026); the publishable key has the exact same low privileges. `createClient`
// usage is identical — you just pass the publishable key where the anon key
// used to go.
//
//   Local dev:   put them in a .env file (see .env.example), never commit it.
//   Production:  set them in Cloudflare Pages -> Settings -> Environment
//                variables, both prefixed with VITE_ so Vite exposes them.
//
// NEVER put a secret key (sb_secret_... or the legacy service_role) in the
// frontend or in git.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
// Prefer the new publishable key; fall back to a legacy anon key if that's all
// an older project has, so nothing breaks mid-migration.
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !publishableKey) {
  // Don't hard-crash the bundle — log loudly so a missing env is obvious.
  // (Login will simply fail to reach the backend until this is fixed.)
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. " +
      "Set them in .env (dev) or Cloudflare Pages env vars (prod).",
  );
}

export const supabase = createClient(
  url || "https://YOUR-PROJECT.supabase.co",
  publishableKey || "sb_publishable_xxx",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

// Turn a Postgres timestamptz (ISO string) into the { seconds } shape the UI
// already expects (it was written against Firestore Timestamps). Keeps every
// component/util that reads `.seconds` working without changes.
export function toTs(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? { seconds: Math.floor(ms / 1000) } : null;
}

// Reject if a network call hangs, so the UI can show an error/retry instead of
// spinning forever.
export function withTimeout(promise, ms = 15000, label = "Request") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out. Check your connection.`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Unwrap a supabase-js result, throwing on error so callers can try/catch.
export function unwrap({ data, error }, label = "Request") {
  if (error) {
    const e = new Error(error.message || `${label} failed`);
    e.code = error.code;
    e.details = error.details;
    throw e;
  }
  return data;
}
