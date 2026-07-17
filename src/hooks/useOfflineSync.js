// src/hooks/useOfflineSync.js
// Watches connectivity and flushes any queued month saves when back online.
import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { peekAll, removeMonth, count } from "../utils/offlineQueue.js";
import { StockCountService } from "../services/StockCountService.js";

export function useOfflineSync() {
  const qc = useQueryClient();
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [pending, setPending] = useState(count());

  const flush = useCallback(async () => {
    const entries = peekAll();
    setPending(entries.length);
    if (entries.length === 0) return;

    for (const entry of entries) {
      try {
        await StockCountService.saveMonth(entry);
        removeMonth(entry.monthId);
        qc.invalidateQueries({ queryKey: ["stockMonth", entry.monthId] });
        qc.invalidateQueries({ queryKey: ["stockMonths"] });
      } catch {
        // Leave it queued; we'll retry on the next online event.
        break;
      }
    }
    setPending(count());
  }, [qc]);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      flush();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Attempt a flush on mount in case we start online with a stale queue.
    if (navigator.onLine) flush();

    // Poll the queue size so the banner stays accurate.
    const t = setInterval(() => setPending(count()), 4000);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(t);
    };
  }, [flush]);

  return { isOnline, pending, flush };
}
