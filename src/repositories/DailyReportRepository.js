// src/repositories/DailyReportRepository.js
//
// Supabase data access for the Daily Sale Report.
//
// This is the ADAPTER between the app's in-memory shape (camelCase, "Yes"/"No"
// strings, a delivery object keyed by platform name) and the normalised
// Postgres schema (snake_case, booleans, child tables). Everything above this
// file works in the app shape; everything below it in the DB shape. Keeping the
// translation in one place is what let the ported form stay almost untouched.
//
// Writes go through the save_dsr_report RPC so the header and all three child
// tables land in a single transaction.
import { supabase } from "../supabase.js";
import { asAppError } from "../utils/networkError.js";
import { todayStr, daysAgoStr } from "../utils/dateUtils.js";

// Reject if a network call takes too long, so the UI shows an error/retry
// instead of spinning forever when a request stalls (common in WKWebView).
const withTimeout = (promise, ms = 15000, label = "Request") => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out. Check your connection.`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

// "Yes"/"No" <-> boolean. The form's radio groups still speak Yes/No; the
// database stores real booleans. null/"" round-trips as "" (not answered).
const toBool = (v) => (v === "Yes" ? true : v === "No" ? false : null);
const fromBool = (v) => (v === true ? "Yes" : v === false ? "No" : "");

const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Everything the app needs for one report, in one round trip.
const SELECT = `
  report_date,
  total_sale_pos, online_sale_pos, card_sale_pos, cash_sale_pos,
  is_matching_fiskalne, is_matching_ing,
  cash_from_yesterday, total_cash_in_box,
  received_coupons, comments,
  morning_cash, reporter_id, submitted_by, created_at, updated_at,
  reporter:employees!dsr_reports_reporter_id_fkey ( id, name ),
  dsr_platform_delivery ( online, cash, card, delivery_platforms ( name ) ),
  dsr_cash_movements ( direction, amount, reason, seq, ts ),
  dsr_coupons ( kind, percentage, pos_order_number, qty, employee_id, employees ( name ) )
`;

// DB row (with its embedded children) -> the shape the form/admin components use.
function toAppShape(row) {
  if (!row) return null;

  const delivery = {};
  for (const d of row.dsr_platform_delivery || []) {
    const name = d?.delivery_platforms?.name;
    if (!name) continue;
    delivery[name] = { online: num(d.online), cash: num(d.cash), card: num(d.card) };
  }

  const cashTakenList = [];
  const cashAddedList = [];
  for (const m of row.dsr_cash_movements || []) {
    // `seq` is the entry-order key. Rows written before the timestamptz bug
    // was fixed carry the same integer in `ts`, so fall back to it.
    const entry = {
      amount: num(m.amount),
      reason: m.reason || "",
      seq: m.seq ?? (Number.isFinite(Number(m.ts)) ? Number(m.ts) : null),
    };
    (m.direction === "added" ? cashAddedList : cashTakenList).push(entry);
  }

  const couponsDetails = [];
  const couponsGiven = [];
  for (const c of row.dsr_coupons || []) {
    if (c.kind === "received") {
      couponsDetails.push({
        percentage: num(c.percentage),
        posOrderNumber: c.pos_order_number || "",
      });
    } else if (c.kind === "given") {
      couponsGiven.push({
        employeeId: c.employee_id,
        name: c?.employees?.name || "",
        count: num(c.qty),
      });
    }
  }
  couponsGiven.sort((a, b) => a.name.localeCompare(b.name));

  // ---- Derived figures ------------------------------------------------------
  // These are NOT stored (3NF): Postgres exposes them as v_dsr_report_totals
  // for SQL/reporting, and we recompute the same formulas here so the admin
  // dashboard, CSV export and detail modal keep reading them off the report
  // object exactly as they did under Firestore — no extra round trip.
  const deliveryValues = Object.values(delivery);
  const deliveryBreakdownTotal = round2(
    deliveryValues.reduce((s, d) => s + d.online + d.cash + d.card, 0),
  );
  const deliveryOnlineTotal = round2(
    deliveryValues.reduce((s, d) => s + d.online, 0),
  );
  const sumAmount = (list) => list.reduce((s, m) => s + m.amount, 0);
  const autoCalculatedCash = round2(
    num(row.cash_from_yesterday) +
      num(row.cash_sale_pos) +
      sumAmount(cashAddedList) -
      sumAmount(cashTakenList),
  );
  const rawDiff = round2(num(row.total_cash_in_box) - autoCalculatedCash);
  const cashMismatch = Math.abs(rawDiff) > 0.01;

  return {
    // report_date is the primary key now, so it is also the report's identity.
    id: row.report_date,
    dateString: row.report_date,

    totalSalePOS: num(row.total_sale_pos),
    onlineSalePOS: num(row.online_sale_pos),
    cardSalePOS: num(row.card_sale_pos),
    cashSalePOS: num(row.cash_sale_pos),

    isMatchingFiskalne: fromBool(row.is_matching_fiskalne),
    isMatchingING: fromBool(row.is_matching_ing),

    cashFromYesterday: num(row.cash_from_yesterday),
    // Optional, so null stays null rather than collapsing to 0 — a blank and a
    // genuine zero float mean different things.
    morningCash: row.morning_cash == null ? "" : num(row.morning_cash),
    totalCashInBox: num(row.total_cash_in_box),

    receivedCoupons: fromBool(row.received_coupons),
    comments: row.comments || "",

    reporterId: row.reporter_id,
    reporter: row?.reporter?.name || "",
    submittedBy: row.submitted_by,

    delivery,
    cashTakenList,
    cashAddedList,
    couponsDetails,
    couponsGiven,

    // Derived (see above) — mirrors public.v_dsr_report_totals.
    deliveryBreakdownTotal,
    deliveryOnlineTotal,
    autoCalculatedCash,
    cashMismatch,
    mismatchDiff: cashMismatch ? Math.abs(rawDiff) : 0,
    onlineSaleMismatch:
      Math.abs(num(row.online_sale_pos) - deliveryOnlineTotal) > 0.01,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class DailyReportRepository {
  // ==========================================
  // 1. LAST CLOSING CASH (for "Cash From Yesterday")
  // ==========================================
  // Uses the get_last_closing_cash RPC rather than reading a report row, so it
  // works even when the most recent report is outside the staff 3-day window.
  static async getLastClosingCash() {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc("get_last_closing_cash"),
        15000,
        "Loading data",
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return { cash: num(row.total_cash_in_box), date: row.report_date || null };
    } catch (error) {
      console.error("Repository Error fetching last closing cash:", error);
      return null; // Return null so the Service can default to 0
    }
  }

  // ==========================================
  // 2. SAVE (create or update — one report per day, so this is an upsert)
  // ==========================================
  // `payload` is the app-shape object from DailyReportModel.cleanPayloadForDatabase.
  // `overrideDate` lets an admin file/backdate a specific day; staff pass null
  // and the RPC pins the row to today regardless of what the client sends.
  static async saveReport(payload, overrideDate = null) {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc("save_dsr_report", {
          p_report_date: overrideDate || null,
          p_header: {
            total_sale_pos: payload.totalSalePOS,
            online_sale_pos: payload.onlineSalePOS,
            card_sale_pos: payload.cardSalePOS,
            cash_sale_pos: payload.cashSalePOS,
            is_matching_fiskalne: toBool(payload.isMatchingFiskalne),
            is_matching_ing: toBool(payload.isMatchingING),
            cash_from_yesterday: payload.cashFromYesterday,
            morning_cash: payload.morningCash,
            total_cash_in_box: payload.totalCashInBox,
            received_coupons: toBool(payload.receivedCoupons),
            comments: payload.comments,
            reporter_id: payload.reporterId,
          },
          p_delivery: Object.entries(payload.delivery || {}).map(
            ([platform, d]) => ({
              platform,
              online: d.online,
              cash: d.cash,
              card: d.card,
            }),
          ),
          p_cash: [
            ...(payload.cashTakenList || []).map((m) => ({
              direction: "taken",
              amount: m.amount,
              reason: m.reason,
              seq: m.seq ?? null,
            })),
            ...(payload.cashAddedList || []).map((m) => ({
              direction: "added",
              amount: m.amount,
              reason: m.reason,
              seq: m.seq ?? null,
            })),
          ],
          p_coupons: [
            ...(payload.couponsDetails || []).map((c) => ({
              kind: "received",
              percentage: c.percentage,
              pos_order_number: c.posOrderNumber,
            })),
            ...(payload.couponsGiven || []).map((c) => ({
              kind: "given",
              employee_id: c.employeeId,
              qty: c.qty,
            })),
          ],
        }),
        20000,
        "Saving report",
      );
      if (error) throw error;
      // The RPC returns the resolved business date, which IS the report's id.
      return { id: data, dateString: data };
    } catch (error) {
      console.error("Repository Error saving report:", error);
      // asAppError, not new Error: a rejected fetch is a TypeError, and
      // rebuilding it as a plain Error would drop the one signal the caller
      // uses to decide whether to queue the report instead of losing it.
      throw asAppError(error, "Failed to save report to database.");
    }
  }

  // ==========================================
  // 3. FETCH BY DATE RANGE (inclusive, newest first)
  // ==========================================
  // RLS silently trims this to the last 3 days for staff; admins get it all.
  static async getReportsByDateRange(startDateStr, endDateStr) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("dsr_reports")
          .select(SELECT)
          .gte("report_date", startDateStr)
          .lte("report_date", endDateStr)
          .order("report_date", { ascending: false }),
        15000,
        "Loading reports",
      );
      if (error) throw error;
      return (data || []).map(toAppShape);
    } catch (error) {
      console.error("Repository Error fetching reports:", error);
      throw asAppError(error, "Failed to fetch reports.");
    }
  }

  // ==========================================
  // 4. FETCH ONE DAY (null when that day has no report yet)
  // ==========================================
  static async getReportByDate(dateStr) {
    try {
      const { data, error } = await withTimeout(
        supabase.from("dsr_reports").select(SELECT).eq("report_date", dateStr).maybeSingle(),
        15000,
        "Loading report",
      );
      if (error) throw error;
      return toAppShape(data);
    } catch (error) {
      console.error("Repository Error fetching report:", error);
      throw new Error("Failed to fetch report. " + error.message);
    }
  }

  // ==========================================
  // 5. MONTHLY COUPON TOTALS (per employee)
  // ==========================================
  // Reads v_coupon_counts, which is SECURITY DEFINER on purpose: it exposes
  // only date + employee name + qty, so staff can see a full month of coupon
  // totals without being able to read the financial rows in dsr_reports.
  static async getCouponCountsForMonth(monthKey) {
    const { data, error } = await withTimeout(
      supabase
        .from("v_coupon_counts")
        .select("employee_id, employee_name, qty")
        .eq("month_key", monthKey),
      15000,
      "Loading coupon totals",
    );
    if (error) throw error;
    return data || [];
  }

  // Convenience wrappers used by the panels.
  static getTodayReport() {
    return DailyReportRepository.getReportByDate(todayStr());
  }

  static getRecentReports(days = 3) {
    return DailyReportRepository.getReportsByDateRange(daysAgoStr(days - 1), todayStr());
  }
}
