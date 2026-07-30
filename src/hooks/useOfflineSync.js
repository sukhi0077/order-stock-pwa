// src/hooks/useOfflineSync.js
// Watches connectivity and flushes anything queued while offline: month-end
// stock counts AND daily sale reports. Two independent queues, one banner.
import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { peekAll, removeMonth, count } from "../utils/offlineQueue.js";
import { StockCountService } from "../services/StockCountService.js";
import { dsrOfflineQueue, flushDsrQueue } from "../utils/dsrOfflineQueue.js";

export function useOfflineSync() {
  const qc = useQueryClient();
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  // Both queues contribute to the "n pending" banner.
  const total = () => count() + dsrOfflineQueue.size();
  const [pending, setPending] = useState(total);

  const flush = useCallback(async () => {
    // Daily sale reports first — they are time-sensitive (the next day's
    // "cash from yesterday" reads the latest saved report).
    try {
      await flushDsrQueue();
    } catch {
      // Leave them queued; we'll retry on the next online event.
    }

    const entries = peekAll();
    setPending(count() + dsrOfflineQueue.size());
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
    setPending(count() + dsrOfflineQueue.size());
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
    const t = setInterval(() => setPending(count() + dsrOfflineQueue.size()), 4000);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(t);
    };
  }, [flush]);

  return { isOnline, pending, flush };
}
