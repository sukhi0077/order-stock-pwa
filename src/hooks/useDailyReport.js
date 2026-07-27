// src/hooks/useDailyReport.js
//
// All the state, derived maths and save behaviour behind DailyReportForm.
// Ported from dsr-pwa; the Firestore specifics are gone (the repository now
// talks to Supabase) and two shapes changed with the new schema:
//   * reporter free text  -> reporterId (dropdown)
//   * couponsGivenCount   -> couponsGiven: [{ employeeId, name, count }]
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DailyReportModel } from "../models/DailyReportModel.js";
import { DailyReportService } from "../services/DailyReportService.js";
import { dsrOfflineQueue } from "../utils/dsrOfflineQueue.js";
import { useDeliveryPlatforms } from "./useDeliveryPlatforms.js";

const DRAFT_STORAGE_KEY = "daily_report_draft";

export function useDailyReport(initialData = null, options = {}) {
  const isEditMode = !!initialData;
  // Admin "add a report for a past day" mode.
  const allowBackdate = !isEditMode && !!options.allowBackdate;
  const queryClient = useQueryClient();
  // Holds the last payload we tried to send, so onError can queue it offline.
  const lastPayloadRef = useRef(null);

  const { platforms } = useDeliveryPlatforms();

  // Is this submission eligible for the offline queue? Only normal new staff
  // submissions (not admin edits or backdated entries).
  const canQueueOffline = !isEditMode && !allowBackdate;

  const queueOffline = (payload) => {
    dsrOfflineQueue.add(payload);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    alert(
      "You're offline. The report is saved on this device and will be submitted automatically when you're back online.",
    );
    if (typeof options.onSaved === "function") options.onSaved();
    else {
      setData(DailyReportModel.getInitialState(platforms));
      setHasSubmitted(false);
    }
  };

  // 1. Lazy Initialization: Admin Edit -> (skip draft in backdate mode) ->
  //    Local Draft -> Default State
  const [data, setData] = useState(() => {
    // normalize() backfills any delivery platforms missing from older
    // drafts/reports (e.g. saved before a new platform was added).
    if (initialData) return DailyReportModel.normalize(initialData);

    if (!allowBackdate) {
      try {
        const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (savedDraft) {
          return DailyReportModel.normalize(JSON.parse(savedDraft));
        }
      } catch (error) {
        console.error("Failed to load draft from local storage:", error);
      }
    }
    return DailyReportModel.getInitialState();
  });

  // Backfill delivery rows once the platform list arrives from the database
  // (the initial state was built from FALLBACK_PLATFORMS).
  useEffect(() => {
    if (!platforms?.length) return;
    setData((prev) => {
      const missing = platforms.filter((p) => !prev.delivery?.[p]);
      if (missing.length === 0) return prev;
      const delivery = { ...prev.delivery };
      for (const p of missing) delivery[p] = { online: "", cash: "", card: "" };
      return { ...prev, delivery };
    });
  }, [platforms]);

  // Chosen date for an admin backdated entry (YYYY-MM-DD).
  const [reportDate, setReportDate] = useState(() => options.initialDate || "");

  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Fetch yesterday's cash AND its source date from the database
  const {
    data: yesterdayInfo,
    isLoading: isLoadingPrevData,
    isError: prevDataError,
  } = useQuery({
    queryKey: ["yesterdayInfo"],
    queryFn: DailyReportService.fetchYesterdayInfo,
    retry: 1,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // The actual date the carried-over cash came from (null if unavailable)
  const yesterdayDate = yesterdayInfo?.date || null;

  // 2. DYNAMIC MUTATION: Update if Admin Editing, Create if User Submitting.
  //    A report's identity is its DATE now, so an edit is just a save pinned
  //    to that date — the RPC upserts either way.
  const submitMutation = useMutation({
    mutationFn: (payload) => {
      if (isEditMode && initialData.dateString) {
        return DailyReportService.updateAdminReport(
          initialData.dateString,
          payload,
        );
      }
      return DailyReportService.submitFinalReport(
        payload,
        allowBackdate ? reportDate : null,
      );
    },
    onSuccess: () => {
      alert(
        isEditMode ? "Record Updated Successfully!" : "Report Saved Successfully!",
      );

      // Make sure the next "Cash From Yesterday" reflects what we just saved,
      // and that the coupon totals pick up this report's counts.
      queryClient.invalidateQueries({ queryKey: ["yesterdayInfo"] });
      queryClient.invalidateQueries({ queryKey: ["monthlyCouponCounts"] });

      // A brand-new submission clears the local draft.
      if (!isEditMode) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }

      // Let the caller react (admin: close modal + refresh; staff: show the
      // read-only view of today's just-saved report).
      if (typeof options.onSaved === "function") {
        options.onSaved();
        return;
      }

      // Fallback if no callback was provided: reset in place.
      setData(DailyReportModel.getInitialState(platforms));
      setHasSubmitted(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error) => {
      // If the save failed due to a network problem, queue it offline rather
      // than losing it (only for normal new submissions).
      const networkish =
        (typeof navigator !== "undefined" && navigator.onLine === false) ||
        /timed out|network|unavailable|offline|fetch/i.test(error?.message || "");
      if (canQueueOffline && networkish && lastPayloadRef.current) {
        queueOffline(lastPayloadRef.current);
        return;
      }
      alert(`Error saving report: ${error.message}`);
    },
  });

  // Auto-fill yesterday's cash (NEW reports only). This is a legitimate sync
  // of fetched server data into editable form state, so we intentionally call
  // setState here. In edit mode we keep whatever was originally recorded so
  // the cash chain is never re-fetched or overwritten.
  useEffect(() => {
    // Skip in backdate mode — for a past day the latest report's cash isn't
    // the right "yesterday" value, so the admin enters it manually.
    if (!isEditMode && !allowBackdate && yesterdayInfo !== undefined) {
      setData((prev) =>
        prev.cashFromYesterday === ""
          ? { ...prev, cashFromYesterday: yesterdayInfo.cash }
          : prev,
      );
    }
  }, [yesterdayInfo, isEditMode, allowBackdate]);

  // Derived values — computed during render (no effect/state needed).
  // Postgres computes the same figures in v_dsr_report_totals for reporting;
  // these are the live versions the form needs while you type.
  const autoCalculatedOnlineSale = DailyReportModel.calculateOnlineSale(
    data.delivery,
  );
  const autoCalculatedCash = DailyReportModel.calculateExpectedCash(
    data.cashFromYesterday,
    data.cashSalePOS,
    data.cashTakenList,
    data.cashAddedList,
  );
  const inBox = Number(data.totalCashInBox);
  // Round the difference to 2 decimals and use a small tolerance so float
  // drift (e.g. 100.00000001) never shows a phantom mismatch.
  const rawDiff =
    Math.round((Math.abs(autoCalculatedCash - inBox) + Number.EPSILON) * 100) / 100;
  const cashMismatch = data.totalCashInBox !== "" && rawDiff > 0.001;
  const mismatchDiff = cashMismatch ? rawDiff : 0;

  // Bank transfer (card 1) vs the portals' Online total (card 2). Only flagged
  // once a bank-transfer amount has been entered. A mismatch requires a comment
  // (like Fiskalne/ING) rather than blocking submit.
  const portalOnlineTotal = DailyReportModel.calculateDeliveryOnline(data.delivery);
  const onlineSaleMismatch =
    String(data.onlineSalePOS).trim() !== "" &&
    Math.abs(Number(data.onlineSalePOS) - portalOnlineTotal) > 0.01;

  // Validation Checkers
  const commentReasons = DailyReportModel.getCommentRequirements(
    cashMismatch,
    data.isMatchingFiskalne,
    data.isMatchingING,
    onlineSaleMismatch,
  );
  const isCommentRequired = commentReasons.length > 0;
  const errors = hasSubmitted
    ? DailyReportModel.validate(data, isCommentRequired)
    : {};

  // Form Handlers
  const handleChange = (field, value) =>
    setData((prev) => ({ ...prev, [field]: value }));

  const handleDeliveryChange = (platform, field, value) => {
    setData((prev) => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        [platform]: { ...(prev.delivery[platform] || {}), [field]: value },
      },
    }));
  };

  // Google-review coupons: set one employee's count for today.
  const handleCouponGivenChange = (employee, count) => {
    setData((prev) => {
      const next = (prev.couponsGiven || []).filter(
        (e) => e.employeeId !== employee.id,
      );
      const n = Math.max(0, Math.round(Number(count) || 0));
      if (n > 0) {
        next.push({ employeeId: employee.id, name: employee.name, count: n });
      }
      next.sort((a, b) => a.name.localeCompare(b.name));
      return { ...prev, couponsGiven: next };
    });
  };

  const handleAddCashTaken = () => {
    if (data.cashTakenList.length >= 5) {
      alert(
        "Hold your horses! 🐎 You can only add a maximum of 5 cash payouts per day.",
      );
      return;
    }
    handleChange("cashTakenList", [
      ...data.cashTakenList,
      { amount: "", reason: "" },
    ]);
  };

  const handleRemoveCashTaken = (index) =>
    handleChange(
      "cashTakenList",
      data.cashTakenList.filter((_, i) => i !== index),
    );

  const handleCashTakenChange = (index, field, value) => {
    const newList = data.cashTakenList.map((row, i) =>
      i === index ? { ...row, [field]: value } : row,
    );
    handleChange("cashTakenList", newList);
  };

  const handleAddCashAdded = () => {
    if (data.cashAddedList.length >= 5) {
      alert("You can only add a maximum of 5 cash top-ups per day.");
      return;
    }
    handleChange("cashAddedList", [
      ...data.cashAddedList,
      { amount: "", reason: "" },
    ]);
  };

  const handleRemoveCashAdded = (index) =>
    handleChange(
      "cashAddedList",
      data.cashAddedList.filter((_, i) => i !== index),
    );

  const handleCashAddedChange = (index, field, value) => {
    const newList = data.cashAddedList.map((row, i) =>
      i === index ? { ...row, [field]: value } : row,
    );
    handleChange("cashAddedList", newList);
  };

  // Reset every field back to defaults, clear validation state, and discard
  // any locally saved draft so it doesn't reappear on reload.
  const resetForm = async () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear saved draft:", error);
    }
    setHasSubmitted(false);

    // Fetch yesterday's cash fresh and seed the new blank form with it
    // directly. (Relying on the auto-fill effect alone doesn't work: if the
    // refetched value is unchanged, `yesterdayInfo` keeps the same reference
    // and the effect never re-runs, leaving the field empty.)
    let freshCash = yesterdayInfo?.cash ?? "";
    try {
      const latest = await queryClient.fetchQuery({
        queryKey: ["yesterdayInfo"],
        queryFn: DailyReportService.fetchYesterdayInfo,
      });
      if (latest && latest.cash !== undefined) freshCash = latest.cash;
    } catch (error) {
      console.error("Failed to refresh yesterday's cash:", error);
    }

    setData({
      ...DailyReportModel.getInitialState(platforms),
      cashFromYesterday: freshCash,
    });
  };

  // Save Draft Locally
  const handleSaveDraft = () => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
      alert("Draft saved locally! You can safely close the app and resume later.");
    } catch (error) {
      console.error("Failed to save draft:", error);
      alert("Failed to save draft to your device.");
    }
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setHasSubmitted(true);

    // 1. Run local validations first. If invalid, stop here — the form's
    //    effect scrolls the user to the first errored field.
    const currentErrors = DailyReportModel.validate(data, isCommentRequired);
    if (Object.keys(currentErrors).length > 0) return;

    // Backdated admin entry must have a date chosen.
    if (allowBackdate && !reportDate) {
      alert("Please pick the date for this report.");
      return window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // 2. Concurrency Check (only for a normal NEW submission — not admin edit
    //    and not a backdated entry, where the latest-cash check is irrelevant).
    if (!isEditMode && !allowBackdate) {
      try {
        const latestInfo = await DailyReportService.fetchYesterdayInfo();
        const latestDatabaseCash = latestInfo?.cash ?? 0;
        if (Number(latestDatabaseCash) !== Number(data.cashFromYesterday)) {
          alert(
            `WARNING: Database Conflict! Someone else submitted a report while you had this tab open. The starting cash changed from ${data.cashFromYesterday} to ${latestDatabaseCash}. We've refreshed "Cash From Yesterday" with the latest value — please review the totals and submit again.`,
          );
          // Pull the fresh value into state + cache instead of reloading the
          // page (a page reload restored the stale draft value).
          queryClient.setQueryData(["yesterdayInfo"], latestInfo);
          setData((prev) => ({ ...prev, cashFromYesterday: latestDatabaseCash }));
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      } catch (err) {
        console.error("Could not verify concurrency", err);
      }
    }

    if (
      !window.confirm(
        isEditMode
          ? "Ready to update this historical record?"
          : "Looks good! Ready to save this report?",
      )
    )
      return;

    // 3. Clean and Save
    const finalPayload = DailyReportModel.cleanPayloadForDatabase(data);

    // Offline? Queue immediately instead of attempting a doomed round trip.
    if (
      canQueueOffline &&
      typeof navigator !== "undefined" &&
      navigator.onLine === false
    ) {
      queueOffline(finalPayload);
      return;
    }

    lastPayloadRef.current = finalPayload;
    submitMutation.mutate(finalPayload);
  };

  return {
    data,
    platforms,
    errors,
    hasSubmitted,
    isSaving: submitMutation.isPending,
    isLoadingPrevData,
    prevDataError,
    yesterdayDate,
    allowBackdate,
    reportDate,
    setReportDate,
    autoCalculatedCash,
    autoCalculatedOnlineSale,
    portalOnlineTotal,
    cashMismatch,
    mismatchDiff,
    onlineSaleMismatch,
    isCommentRequired,
    commentReasons,
    handleChange,
    handleDeliveryChange,
    handleCouponGivenChange,
    handleAddCashTaken,
    handleRemoveCashTaken,
    handleCashTakenChange,
    handleAddCashAdded,
    handleRemoveCashAdded,
    handleCashAddedChange,
    handleSubmit,
    handleSaveDraft,
    resetForm,
  };
}
