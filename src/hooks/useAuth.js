// src/hooks/useAuth.js
import { useState, useEffect } from "react";
import { supabase } from "../supabase.js";

// Map a Supabase auth error to the legacy error codes the Login screen knows.
function mapAuthError(error) {
  const msg = (error?.message || "").toLowerCase();
  if (error?.status === 429 || msg.includes("rate")) return "auth/too-many-requests";
  if (msg.includes("invalid login") || msg.includes("invalid credentials"))
    return "auth/invalid-credential";
  if (msg.includes("email") && msg.includes("invalid")) return "auth/invalid-email";
  if (msg.includes("network") || msg.includes("fetch")) return "auth/network-request-failed";
  return "auth/generic";
}

// Normalize a Supabase user to the { uid, email } shape the app was built on.
const shape = (u) => (u ? { uid: u.id, email: u.email } : null);

// Tracks the logged-in user and whether they are an admin.
// Admin status = public.profiles.role === 'admin' for this user.
export function useAuth() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [adminError, setAdminError] = useState("");

  useEffect(() => {
    let active = true;

    async function resolveRole(authUser) {
      if (!authUser) {
        if (active) setIsAdmin(false);
        return;
      }
      try {
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("TIMED OUT — cannot reach Supabase")), 8000),
        );
        const { data, error } = await Promise.race([
          supabase.from("profiles").select("role").eq("id", authUser.id).maybeSingle(),
          timeout,
        ]);
        if (!active) return;
        if (error) throw error;
        const admin = data?.role === "admin";
        setIsAdmin(admin);
        setAdminError(data ? "" : "no profile row for this user");
      } catch (error) {
        if (!active) return;
        console.error("Failed to verify admin status:", error);
        setIsAdmin(false);
        setAdminError(`${error?.code || "error"}: ${error?.message || error}`);
      }
    }

    // Initial session
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const authUser = data?.session?.user || null;
      setUser(shape(authUser));
      resolveRole(authUser).finally(() => active && setIsAuthLoading(false));
    });

    // React to sign-in / sign-out / token refresh
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const authUser = session?.user || null;
      setUser(shape(authUser));
      setIsAuthLoading(false);
      resolveRole(authUser);
    });

    // Safety net: never hang on the loading screen.
    const failSafe = setTimeout(() => active && setIsAuthLoading(false), 6000);

    return () => {
      active = false;
      clearTimeout(failSafe);
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      const e = new Error(error.message);
      e.code = mapAuthError(error);
      throw e;
    }
  };

  const logout = async () => {
    sessionStorage.removeItem("isAdminView");
    await supabase.auth.signOut();
  };

  return { user, isAdmin, isAuthLoading, adminError, login, logout };
}
