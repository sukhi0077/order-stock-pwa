// src/hooks/useOrder.js
//
// Drives a single order. Two modes:
//   - Draft mode (no orderId): the one running draft, built up over several
//     days. Every Add/Remove auto-saves it; "Submit" sends it to the admin.
//   - By-id mode (orderId given): a specific order an admin is modifying;
//     Add/Remove auto-save it in place.
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OrderService } from "../services/OrderService.js";
import { toLines, validateLines, summarize, STATUS } from "../models/OrderModel.js";

export function useOrder({ items, reporter, orderId = null }) {
  const qc = useQueryClient();
  const isDraftMode = !orderId;

  const orderQuery = useQuery({
    queryKey: isDraftMode ? ["orderDraft"] : ["order", orderId],
    queryFn: () => (isDraftMode ? OrderService.getDraft() : OrderService.getById(orderId)),
    enabled: items.length > 0,
  });

  const order = orderQuery.data || null;
  const status = order?.status || STATUS.DRAFT;

  const [lines, setLines] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // The id we're writing to (survives across quick adds before the query
  // refetches). Draft mode starts null and is set on first create.
  const idRef = useRef(null);

  useEffect(() => {
    if (orderQuery.isSuccess) {
      setLines(toLines(order?.lines || {}));
      idRef.current = isDraftMode ? order?.id || null : orderId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderQuery.isSuccess, order?.id, orderId]);

  const summary = useMemo(() => summarize(items, lines), [items, lines]);

  const persist = useCallback(
    async (theLines, nextStatus) => {
      setSaveError("");
      const { ok } = validateLines(theLines);
      if (!ok) {
        setSaveError("Some quantities or notes are invalid. Please review.");
        throw new Error("validation");
      }
      setSaving(true);
      try {
        const id = idRef.current;
        const args = { orderId: id, reporter, status: nextStatus, lines: theLines };
        const res = isDraftMode
          ? await OrderService.saveDraft(args)
          : await OrderService.update(orderId, args);
        if (isDraftMode) {
          if (nextStatus === STATUS.SUBMITTED) idRef.current = null;
          else if (!id && res?.id) idRef.current = res.id;
        }
        qc.invalidateQueries({ queryKey: ["orderDraft"] });
        qc.invalidateQueries({ queryKey: ["orders"] });
        if (idRef.current) qc.invalidateQueries({ queryKey: ["order", idRef.current] });
        return res;
      } catch (e) {
        setSaveError(e.message || "Failed to save the order.");
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [reporter, isDraftMode, orderId, qc],
  );

  // Add / update one item's line (auto-saves the order).
  const addLine = useCallback(
    (itemId, { qty, note }) => {
      const next = { ...lines, [itemId]: { qty, note: note || "" } };
      setLines(next);
      return persist(next, status === STATUS.SUBMITTED ? STATUS.SUBMITTED : STATUS.DRAFT);
    },
    [lines, persist, status],
  );

  // Remove an item from the order (auto-saves).
  const removeLine = useCallback(
    (itemId) => {
      const next = { ...lines };
      delete next[itemId];
      setLines(next);
      return persist(next, status === STATUS.SUBMITTED ? STATUS.SUBMITTED : STATUS.DRAFT);
    },
    [lines, persist, status],
  );

  // Submit the running draft to the admin.
  const submit = useCallback(() => persist(lines, STATUS.SUBMITTED), [lines, persist]);

  return {
    isLoading: orderQuery.isLoading,
    order,
    status,
    lines,
    summary,
    saving,
    saveError,
    addLine,
    removeLine,
    submit,
  };
}
