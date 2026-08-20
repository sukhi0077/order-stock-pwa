// src/models/RotaModel.js
//
// The rota, as pure functions. A shift is one employee on one date, with
// optional clock times. Everything the schedule view depends on lives here so
// it can be tested without a database or a browser.
//
// Times are CLOCK times ("17:00"), like the timesheet — see TimesheetModel for
// why they are strings and not timestamps.

// A shift row the owner assigned: { employeeId, onDate, startTime, endTime, note }.
// Presence of a shift for a date means "scheduled". Times may be null: the
// common case is "assign the day", and an exact start/end is added only when it
// matters.

// Split a flat list of shift rows into { [employeeId]: { [onDate]: shift } }, so
// a cell lookup is a plain object read rather than a scan.
export function groupShifts(shifts = []) {
  const byPerson = {};
  for (const s of shifts) {
    if (!s || !s.employeeId || !s.onDate) continue;
    (byPerson[s.employeeId] ||= {})[s.onDate] = s;
  }
  return byPerson;
}

// One cell: is this person scheduled this date, and with what times.
export function shiftFor(dateStr, byDate = {}) {
  const s = byDate[dateStr];
  if (!s) return { scheduled: false, startTime: null, endTime: null, note: "" };
  return {
    scheduled: true,
    startTime: s.startTime || null,
    endTime: s.endTime || null,
    note: s.note || "",
  };
}

// people × dates. Every person gets a row and every date a cell, so a name with
// no shifts still appears — an empty row reads as "nothing scheduled", which is
// the truth, where a missing row would just look like a bug.
export function rotaGrid(dates = [], people = [], byPerson = {}) {
  return people.map((person) => ({
    employeeId: person.id,
    employeeName: person.name,
    cells: dates.map((date) => ({
      date,
      ...shiftFor(date, byPerson[person.id] || {}),
    })),
  }));
}

// How many people are on each date — the "how covered is the 14th" number.
export function rotaDayTallies(dates = [], rows = []) {
  return dates.map((date, i) => {
    let scheduled = 0;
    for (const row of rows) if (row.cells[i]?.scheduled) scheduled += 1;
    return { date, scheduled, total: rows.length };
  });
}

// One person's own upcoming shifts, oldest first, from `fromDate` on — what a
// staff member sees on their timesheet once the month is published. Past days
// are dropped: a rota is about what is coming, and yesterday is the
// timesheet's job now.
export function myShifts(shifts = [], fromDate) {
  return shifts
    .filter((s) => s && s.onDate && (!fromDate || s.onDate >= fromDate))
    .map((s) => ({
      onDate: s.onDate,
      startTime: s.startTime || null,
      endTime: s.endTime || null,
      note: s.note || "",
    }))
    .sort((a, b) => a.onDate.localeCompare(b.onDate));
}

// "17:00 – 23:00", or "" when no times were set. The dash is an en dash to
// match the rest of the app.
export function shiftTimeLabel(shift) {
  if (!shift) return "";
  if (shift.startTime && shift.endTime) return `${shift.startTime} – ${shift.endTime}`;
  if (shift.startTime) return `${shift.startTime} –`;
  if (shift.endTime) return `– ${shift.endTime}`;
  return "";
}

// A month's rota is shown to staff only once published. A month with no status
// row is a draft. Kept here so the same rule is used by the staff view and the
// admin badge.
export function isPublished(status) {
  return status === "published";
}
