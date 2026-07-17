// src/hooks/useStockCount.js
//
// The "brain" for a single month's CLOSING stock count. Loads the saved month
// (and the previous month's closing, shown as a reference), holds the editable
// per-item closing values, and AUTO-SAVES on every change (like the order
// flow). "Submit" marks the month submitted; admins can finalize.
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StockCountService } from "../services/StockCountService.js";
import { toCounts, validateClosings, summarizeClosings, STATUS } from "../models/StockCountModel.js";
import { enqueue } from "../utils/offlineQueue.js";

export function useStockCount({ monthId, items, reporter, isOnline = true }) {
  const qc = useQueryClient();
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  const monthQuery = useQuery({
    queryKey: ["stockMonth", monthId],
    queryFn: async () => {
      const [month, prevClosing] = await Promise.all([
        StockCountService.getMonth(monthId),
        StockCountService.getPrevClosing(monthId),
      ]);
      return { month, prevClosing };
    },
    enabled: !!monthId && itemIds.length > 0,
  });

  const saved = monthQuery.data?.month || null;
  const prevClosing = monthQuery.data?.prevClosing || {};

  const [counts, setCounts] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (monthQuery.isSuccess) setCounts(toCounts(saved?.lines || {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthQuery.isSuccess, monthId]);

  const status = saved?.status || STATUS.DRAFT;
  const isFinalized = status === STATUS.FINALIZED;
  // Editing keeps the month's current status (draft stays draft; a submitted
  // month stays submitted) unless we explicitly submit/finalize.
  const editStatus = status === STATUS.SUBMITTED ? STATUS.SUBMITTED : STATUS.DRAFT;

  const persist = useCallback(
    async (nextCounts, nextStatus) => {
      setSaveError("");
      const { ok } = validateClosings(nextCounts);
      if (!ok) {
        setSaveError("Some quantities are invalid. Please review and try again.");
        throw new Error("validation");
      }
      const args = { monthId, reporter, status: nextStatus, counts: nextCounts };
      if (!isOnline) {
        enqueue(args);
        return { queued: true };
      }
      setSaving(true);
      try {
        const res = await StockCountService.saveMonth(args);
        qc.invalidateQueries({ queryKey: ["stockMonth", monthId] });
        qc.invalidateQueries({ queryKey: ["stockMonths"] });
        return res;
      } catch (e) {
        setSaveError(e.message || "Failed to save.");
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [monthId, reporter, isOnline, qc],
  );

  // Set one item's closing value and auto-save.
  const commitCount = useCallback(
    (itemId, value) => {
      const next = { ...counts, [itemId]: value };
      setCounts(next);
      return persist(next, editStatus);
    },
    [counts, persist, editStatus],
  );

  // Pre-fill blanks with last month's closing, then save.
  const fillFromLastMonth = useCallback(() => {
    const next = { ...counts };
    for (const [id, v] of Object.entries(prevClosing)) {
      if (next[id] === undefined || String(next[id]).trim() === "") next[id] = v;
    }
    setCounts(next);
    return persist(next, editStatus);
  }, [counts, prevClosing, persist, editStatus]);

  const submit = useCallback(() => persist(counts, STATUS.SUBMITTED), [counts, persist]);
  const setStatus = useCallback((st) => persist(counts, st), [counts, persist]);

  const summary = useMemo(() => summarizeClosings(items, counts), [items, counts]);

  return {
    isLoading: monthQuery.isLoading,
    isError: monthQuery.isError,
    refetch: monthQuery.refetch,
    saved,
    status,
    isFinalized,
    counts,
    prevClosing,
    commitCount,
    fillFromLastMonth,
    submit,
    setStatus,
    summary,
    saving,
    saveError,
  };
}
