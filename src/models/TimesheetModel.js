// src/models/TimesheetModel.js
//
// Hours worked, as pure functions. Everything the payroll number depends on
// lives here so it can be tested without a database or a browser.
//
// Times are CLOCK times ("17:00"), not timestamps. A shift is "17:00 to 01:00
// on the 14th": storing that as a pair of instants would drag in timezone and
// DST handling for no benefit, and would make the two nights of the year when
// Warsaw shifts its clocks quietly wrong.

export const MAX_BREAK_MINUTES = 12 * 60;
// A single stretch longer than this is almost certainly a typo — an end time
// entered as 07:00 instead of 19:00, or a forgotten date.
export const MAX_SHIFT_MINUTES = 16 * 60;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(s) {
  return typeof s === "string" && TIME_RE.test(s.trim());
}

// "17:30" -> 1050. Null for anything unparseable, so a bad value can never be
// silently treated as midnight.
export function toMinutes(time) {
  if (!isValidTime(time)) return null;
  const [h, m] = time.trim().split(":").map(Number);
  return h * 60 + m;
}

// 1050 -> "17:30". Wraps past midnight rather than producing "25:00".
export function toTime(minutes) {
  const m = ((Math.round(Number(minutes) || 0) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// Minutes worked in one stretch, break already deducted.
//
// An end at or before the start means the shift crossed midnight — 22:00 to
// 02:00 is four hours, not minus twenty. Equal times are read as a full 24h
// rather than zero, because nobody records a zero-length shift, and a 24h
// total is loud enough to get noticed and corrected.
export function entryMinutes(entry) {
  const start = toMinutes(entry?.startTime);
  const end = toMinutes(entry?.endTime);
  if (start === null || end === null) return 0;
  const span = end > start ? end - start : end + 1440 - start;
  const brk = Math.max(0, Math.round(Number(entry?.breakMinutes) || 0));
  return Math.max(0, span - brk);
}

export function crossesMidnight(entry) {
  const start = toMinutes(entry?.startTime);
  const end = toMinutes(entry?.endTime);
  if (start === null || end === null) return false;
  return end <= start;
}

// Minutes -> "7h 30m". The unit that gets paid is the hour, but showing 7.5
// invites the reader to wonder whether .5 means 30 or 50 minutes.
export function formatMinutes(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

// Decimal hours, for a spreadsheet or a wage calculation done elsewhere.
// Two decimals: a minute is 0.0167h, so anything coarser loses real time.
export function toDecimalHours(minutes) {
  return Math.round(((Number(minutes) || 0) / 60) * 100) / 100;
}

export function validateEntry(entry) {
  const errors = [];
  if (!entry?.employeeId) errors.push("Pick who worked.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry?.workDate || "")) errors.push("Pick a valid date.");
  if (!isValidTime(entry?.startTime)) errors.push("Enter a start time as HH:MM.");
  if (!isValidTime(entry?.endTime)) errors.push("Enter an end time as HH:MM.");

  const brk = Math.round(Number(entry?.breakMinutes) || 0);
  if (brk < 0) errors.push("A break cannot be negative.");
  if (brk > MAX_BREAK_MINUTES) errors.push("That break looks too long.");

  if (isValidTime(entry?.startTime) && isValidTime(entry?.endTime)) {
    const worked = entryMinutes(entry);
    if (worked <= 0) errors.push("The break is longer than the shift.");
    if (worked > MAX_SHIFT_MINUTES) errors.push("That shift is longer than 16 hours — check the times.");
  }
  return { ok: errors.length === 0, errors };
}

// The row that goes to the database. Times are normalised to HH:MM so a value
// typed as "9:05" is stored the same way as one picked from a time input.
export function buildEntryPayload(entry) {
  return {
    employeeId: entry.employeeId,
    workDate: entry.workDate,
    startTime: toTime(toMinutes(entry.startTime)),
    endTime: toTime(toMinutes(entry.endTime)),
    breakMinutes: Math.max(0, Math.round(Number(entry.breakMinutes) || 0)),
    note: String(entry.note || "").trim().slice(0, 200),
  };
}

// ---------------------------------------------------------------------------
// AGGREGATION

// Group entries into days: [{ date, entries, minutes }], oldest first.
export function byDay(entries = []) {
  const days = new Map();
  for (const e of entries) {
    if (!days.has(e.workDate)) days.set(e.workDate, { date: e.workDate, entries: [], minutes: 0 });
    const d = days.get(e.workDate);
    d.entries.push(e);
    d.minutes += entryMinutes(e);
  }
  for (const d of days.values()) {
    d.entries.sort((a, b) => (toMinutes(a.startTime) ?? 0) - (toMinutes(b.startTime) ?? 0));
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function totalMinutes(entries = []) {
  return entries.reduce((sum, e) => sum + entryMinutes(e), 0);
}

// One employee's month, ready to render or print.
export function monthlySummary(entries = [], monthId) {
  const inMonth = monthId ? entries.filter((e) => String(e.workDate).startsWith(monthId)) : entries;
  const days = byDay(inMonth);
  const minutes = totalMinutes(inMonth);
  return {
    monthId,
    days,
    daysWorked: days.length,
    entryCount: inMonth.length,
    minutes,
    hours: toDecimalHours(minutes),
    formatted: formatMinutes(minutes),
  };
}

// Everyone's month, biggest total first — the shape the admin summary wants.
export function monthlyByEmployee(entries = [], monthId, employees = []) {
  const nameOf = new Map(employees.map((e) => [e.id, e.name]));
  const grouped = new Map();
  for (const e of entries) {
    if (monthId && !String(e.workDate).startsWith(monthId)) continue;
    if (!grouped.has(e.employeeId)) grouped.set(e.employeeId, []);
    grouped.get(e.employeeId).push(e);
  }
  return [...grouped.entries()]
    .map(([employeeId, list]) => ({
      employeeId,
      employeeName: nameOf.get(employeeId) || "Unknown",
      ...monthlySummary(list, monthId),
    }))
    .sort((a, b) => b.minutes - a.minutes || a.employeeName.localeCompare(b.employeeName));
}

// ---------------------------------------------------------------------------
// AVAILABILITY
//
// A weekly pattern with per-date exceptions on top. Reading a date means: use
// the exception if there is one, otherwise the weekday's pattern, otherwise
// treat it as unknown rather than guessing either way.

// 0 = Monday ... 6 = Sunday, matching the schema and how a rota is read.
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function weekdayOf(dateStr) {
  // getUTCDay is 0=Sunday; shift so Monday is 0.
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return (d.getUTCDay() + 6) % 7;
}

export function availabilityFor(dateStr, { weekly = [], exceptions = [] } = {}) {
  const ex = exceptions.find((x) => x.onDate === dateStr);
  if (ex) {
    return {
      source: "exception",
      available: ex.available !== false,
      fromTime: ex.fromTime || null,
      toTime: ex.toTime || null,
      note: ex.note || "",
    };
  }
  const wd = weekdayOf(dateStr);
  const pattern = wd === null ? null : weekly.find((w) => w.weekday === wd);
  if (pattern) {
    return {
      source: "weekly",
      available: pattern.available !== false,
      fromTime: pattern.fromTime || null,
      toTime: pattern.toTime || null,
      note: "",
    };
  }
  // Nothing said either way. Deliberately not "available": an unanswered day
  // is not a promise, and rostering someone off the back of silence is how
  // people end up expected on a shift they never agreed to.
  return { source: "none", available: null, fromTime: null, toTime: null, note: "" };
}
