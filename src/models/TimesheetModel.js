// src/models/TimesheetModel.js
//
// Hours worked, as pure functions. Everything the payroll number depends on
// lives here so it can be tested without a database or a browser.
//
// Times are CLOCK times ("17:00"), not timestamps. A shift is "17:00 to 01:00
// on the 14th": storing that as a pair of instants would drag in timezone and
// DST handling for no benefit, and would make the two nights of the year when
// Warsaw shifts its clocks quietly wrong.

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

// Minutes worked in one stretch.
//
// An end at or before the start means the shift crossed midnight — 22:00 to
// 02:00 is four hours, not minus twenty. Equal times are read as a full 24h
// rather than zero, because nobody records a zero-length shift, and a 24h
// total is loud enough to get noticed and corrected.
//
// Breaks are no longer recorded, but a stored break is still subtracted: rows
// saved before the field was dropped were totalled with it deducted, and
// silently paying those minutes back would change hours already signed off.
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

  if (isValidTime(entry?.startTime) && isValidTime(entry?.endTime)) {
    const worked = entryMinutes(entry);
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

// `explicitOnly` drops the weekly-pattern fallback, leaving only the dates a
// person actually answered. The admin view uses it: a usual week is a habit,
// not a commitment to a particular Tuesday, and treating one as the other is
// how somebody ends up rostered on a day they never agreed to.
export function availabilityFor(
  dateStr,
  { weekly = [], exceptions = [] } = {},
  { explicitOnly = false } = {},
) {
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
  if (explicitOnly) {
    return { source: "none", available: null, fromTime: null, toTime: null, note: "" };
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

// ---------------------------------------------------------------------------
// THE CONSOLIDATED VIEW
//
// One person's availability is a question. Everyone's, side by side over the
// same dates, is a rota — which is the thing the owner actually needs before
// deciding who to ask.

// Split a flat list of rows into { [employeeId]: { weekly, exceptions } }, the
// shape availabilityFor already understands.
export function groupAvailability(weekly = [], exceptions = []) {
  const byPerson = {};
  const bucket = (id) =>
    (byPerson[id] ||= { weekly: [], exceptions: [] });
  for (const w of weekly) bucket(w.employeeId).weekly.push(w);
  for (const e of exceptions) bucket(e.employeeId).exceptions.push(e);
  return byPerson;
}

// people × dates. Every person gets a row and every date a cell, including the
// people who have answered nothing: a name missing from the grid reads as "not
// working", when what it means is "has not said".
export function availabilityGrid(dates = [], people = [], byPerson = {}, options = {}) {
  return people.map((person) => ({
    employeeId: person.id,
    employeeName: person.name,
    cells: dates.map((date) => ({
      date,
      ...availabilityFor(date, byPerson[person.id] || {}, options),
    })),
  }));
}

// How many people are free on each date, and how many have not answered.
// The unanswered count is carried deliberately: "3 available" means something
// different when the other two said no than when they never replied.
export function dayTallies(dates = [], rows = []) {
  return dates.map((date, i) => {
    let available = 0;
    let unavailable = 0;
    let unknown = 0;
    for (const row of rows) {
      const cell = row.cells[i];
      if (cell?.available === true) available += 1;
      else if (cell?.available === false) unavailable += 1;
      else unknown += 1;
    }
    return { date, available, unavailable, unknown, total: rows.length };
  });
}

// Which dates a "I usually work Tuesdays" tap should actually fill in.
//
// Three filters, each there for a reason:
//   - the right weekday, obviously;
//   - nothing before `fromDate`, because answering for last Tuesday is not a
//     thing anyone needs to do;
//   - nothing already answered, so a day marked as leave is never overwritten
//     by a habit. Losing a booked holiday to a stray tap on a weekday chip is
//     the one outcome this must not produce.
export function fillableDates(dates = [], weekday, fromDate, availability = {}) {
  return dates.filter(
    (date) =>
      date >= fromDate &&
      weekdayOf(date) === weekday &&
      availabilityFor(date, availability, { explicitOnly: true }).source !== "exception",
  );
}

// Split dates into calendar weeks starting Monday, padding the first and last
// week with nulls so every week has 7 slots and the columns line up under
// Mon–Sun. A month that starts on a Thursday must not shift every row.
export function weeksOf(dates = []) {
  if (dates.length === 0) return [];
  const weeks = [];
  let week = new Array(weekdayOf(dates[0]) ?? 0).fill(null);
  for (const date of dates) {
    week.push(date);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) weeks.push([...week, ...new Array(7 - week.length).fill(null)]);
  return weeks;
}
