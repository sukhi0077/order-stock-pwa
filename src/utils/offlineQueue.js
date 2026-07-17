// src/utils/offlineQueue.js
// A tiny localStorage-backed queue so a month's count can be saved while
// offline and flushed once the connection returns. One entry per month id
// (a later save for the same month replaces the earlier queued one).

const KEY = "stock_offline_queue_v1";

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(arr) {
  try {
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch {
    // Storage full / unavailable — nothing we can safely do here.
  }
}

// Add or replace the queued save for a month.
export function enqueue(entry) {
  const arr = read().filter((e) => e.monthId !== entry.monthId);
  arr.push({ ...entry, queuedAt: Date.now() });
  write(arr);
}

export function peekAll() {
  return read();
}

export function count() {
  return read().length;
}

export function removeMonth(monthId) {
  write(read().filter((e) => e.monthId !== monthId));
}

export function clear() {
  write([]);
}
