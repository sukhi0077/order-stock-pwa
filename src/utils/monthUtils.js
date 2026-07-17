// src/utils/monthUtils.js
// Single source of truth for month handling. A "month id" is YYYY-MM.
// "This month" is evaluated in the business timezone so the client and the
// Firestore rules agree around the local/UTC month boundary.

export const APP_TIME_ZONE = "Europe/Warsaw";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Current business-timezone month as YYYY-MM.
export function currentMonthId(date = new Date()) {
  // en-CA gives YYYY-MM-DD; slice to YYYY-MM in the business timezone.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  })
    .format(date)
    .slice(0, 7);
}

// Shift a YYYY-MM by N months, computed in UTC so the device timezone can never
// change the result. Returns YYYY-MM.
export function shiftMonthId(monthId, deltaMonths) {
  const [y, m] = String(monthId).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, 1));
  dt.setUTCMonth(dt.getUTCMonth() + deltaMonths);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

// The previous / next month id.
export function prevMonthId(monthId) {
  return shiftMonthId(monthId, -1);
}
export function nextMonthId(monthId) {
  return shiftMonthId(monthId, 1);
}

// ---- Day-level helpers (for expiry tracking) ------------------------------

// Today's business date as YYYY-MM-DD.
export function todayStr(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Shift a YYYY-MM-DD by N days (UTC, device-tz independent).
export function shiftDateStr(dateStr, deltaDays) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

// Whole days from a -> b (b minus a). Negative if b is before a.
export function diffDays(a, b) {
  const p = (s) => {
    const [y, m, d] = String(s).split("-").map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
  };
  return Math.round((p(b) - p(a)) / 86400000);
}

// The month id (YYYY-MM) of a date string.
export function monthOf(dateStr) {
  return String(dateStr).slice(0, 7);
}

// "15 Jul 2026" for a YYYY-MM-DD date.
export function formatDay(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return dateStr || "";
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}

// The last calendar day of a month as YYYY-MM-DD (used as the count date /
// SupplyTracker `happened_at`). Computed in UTC so it's device-tz independent.
export function monthEndDate(monthId) {
  const [y, m] = String(monthId).split("-").map(Number);
  // Day 0 of the next month = last day of this month.
  const dt = new Date(Date.UTC(y, m, 0));
  return dt.toISOString().slice(0, 10);
}

// "June 2026" for display.
export function formatMonthLabel(monthId) {
  const [y, m] = String(monthId).split("-").map(Number);
  if (!y || !m) return monthId;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

// Short "Jun 2026".
export function formatMonthShort(monthId) {
  const [y, m] = String(monthId).split("-").map(Number);
  if (!y || !m) return monthId;
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}

// Is the given month id the current (open) business month?
export function isCurrentMonth(monthId) {
  return monthId === currentMonthId();
}

// A list of the most recent N month ids ending at the current month (newest
// first), e.g. ["2026-07", "2026-06", ...].
export function recentMonthIds(count = 13) {
  const now = currentMonthId();
  const out = [];
  for (let i = 0; i < count; i++) out.push(shiftMonthId(now, -i));
  return out;
}

// Format an absolute instant (e.g. a Firestore serverTimestamp) as
// "YYYY-MM-DD HH:mm" in the business timezone (24h).
export function formatDateTime(date) {
  if (!date) return "";
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
