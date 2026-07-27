// src/services/DailyReportService.js
//
// Use-case layer for the Daily Sale Report. The repository knows Supabase;
// the model knows the maths; this file knows the workflows.
import { DailyReportRepository } from "../repositories/DailyReportRepository.js";
import { DailyReportModel } from "../models/DailyReportModel.js";
import { formatDate, todayStr, daysAgoStr } from "../utils/dateUtils.js";

export class DailyReportService {
  // Returns both the carried-over cash AND the date that cash came from,
  // so the form can show the actual source date (not just calendar yesterday).
  static async fetchYesterdayInfo() {
    const last = await DailyReportRepository.getLastClosingCash();
    if (!last) throw new Error("No previous data found");
    return { cash: last.cash || 0, date: last.date || null };
  }

  // Create or update. One report per day, so the RPC upserts on the date;
  // `overrideDate` is only honoured for admins (the RPC pins staff to today).
  static async submitFinalReport(payload, overrideDate = null) {
    await DailyReportRepository.saveReport(payload, overrideDate);
    return true;
  }

  // Per-employee Google-review coupon totals for the calendar month containing
  // `date`. Read from v_coupon_counts so staff (who can't read a month of
  // reports) can still see their running total.
  // Returns [{ name, count }, ...] sorted by count desc.
  static async fetchMonthlyCouponCounts(date = new Date()) {
    const monthKey = formatDate(date).slice(0, 7); // "YYYY-MM"
    const rows = await DailyReportRepository.getCouponCountsForMonth(monthKey);
    return DailyReportModel.aggregateCouponsByStaff(rows);
  }

  // Reports from the last `days` calendar days (today inclusive). Staff use
  // this to review recent reports; RLS allows 3 days back.
  // Window is computed in Warsaw business dates, independent of device tz.
  static async fetchRecentReports(days = 3) {
    return await DailyReportRepository.getReportsByDateRange(
      daysAgoStr(days - 1),
      todayStr(),
    );
  }

  static async fetchTodayReport() {
    return await DailyReportRepository.getReportByDate(todayStr());
  }

  static async fetchAdminReports(startDate, endDate) {
    // Format JS Date objects into business-timezone "YYYY-MM-DD" strings.
    return await DailyReportRepository.getReportsByDateRange(
      formatDate(startDate),
      formatDate(endDate),
    );
  }

  // Admin edit. The report's identity IS its date, so editing is just a save
  // pinned to that date — no separate update path.
  static async updateAdminReport(dateString, payload) {
    if (!dateString) throw new Error("Report date is missing for update.");
    await DailyReportRepository.saveReport(payload, dateString);
    return true;
  }
}
