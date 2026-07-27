// src/hooks/useBusinessDay.js
import { useState, useEffect } from "react";
import { todayStr } from "../utils/dateUtils.js";

// Returns the current business (Europe/Warsaw) date as "YYYY-MM-DD" and
// re-renders the component when it changes — so an app left open across
// midnight rolls over to the new day WITHOUT needing a close/reopen.
//
// We poll every 30s (cheap) and also re-check whenever the app regains focus
// or visibility (covers a phone waking from sleep / returning from background).
export function useBusinessDay() {
  const [day, setDay] = useState(todayStr);

  useEffect(() => {
    const check = () =>
      setDay((prev) => {
        const now = todayStr();
        return prev === now ? prev : now;
      });

    const interval = setInterval(check, 30 * 1000);
    const onVisible = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, []);

  return day;
}
