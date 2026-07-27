// src/utils/dateUtils.js
// Single source of truth for BUSINESS-DAY handling (used by the Daily Sale
// Report). Month-level helpers for the stock count live in monthUtils.js.

// The business timezone. "Today" is always evaluated here so the client and
// the Postgres RPC (which also uses Europe/Warsaw) agree around midnight.
export const APP_TIME_ZONE = "Europe/Warsaw";

// Format a JS Date as YYYY-MM-DD in the APP timezone.
export function formatDate(date = new Date()) {
  // en-CA gives YYYY-MM-DD; timeZone shifts to the business day boundary.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Today's business date as YYYY-MM-DD.
export function todayStr() {
  return formatDate(new Date());
}

// Shift a YYYY-MM-DD date string by N calendar days, computed in UTC so the
// device's timezone can never change the result. Returns YYYY-MM-DD.
export function shiftDateStr(dateStr, deltaDays) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

// The business (Warsaw) date N days ago — today − n — as YYYY-MM-DD.
export function daysAgoStr(n) {
  return shiftDateStr(todayStr(), -n);
}

// Format an absolute instant (e.g. a Postgres timestamptz string) as
// "YYYY-MM-DD HH:mm" in the business timezone (24h), so submitted/updated
// times always read in Warsaw time regardless of the device's location.
export function formatDateTime(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(",", "");
}
