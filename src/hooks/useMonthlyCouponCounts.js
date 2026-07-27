// src/hooks/useMonthlyCouponCounts.js
import { useQuery } from "@tanstack/react-query";
import { DailyReportService } from "../services/DailyReportService.js";
import { formatDate } from "../utils/dateUtils.js";

// Per-employee Google-review coupon totals for the current calendar month.
// Resets automatically on the 1st (we only ever sum the current month).
export function useMonthlyCouponCounts(date = new Date()) {
  const monthKey = formatDate(date).slice(0, 7); // "YYYY-MM"

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["monthlyCouponCounts", monthKey],
    queryFn: () => DailyReportService.fetchMonthlyCouponCounts(date),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    monthlyCoupons: data || [], // [{ name, count }]
    monthKey,
    isLoading,
    isError,
    refetch,
  };
}
