// src/utils/dsrOfflineQueue.js
// Offline queue for Daily Sale Report submissions.
//
// Separate from utils/offlineQueue.js (which queues month-end stock counts):
// different payload shape, different flush target, different storage key.
//
// Why an app-level queue at all? save_dsr_report is a SECURITY DEFINER RPC —
// it needs a live server round-trip and cannot be replayed from the Supabase
// client's own cache. So we persist pending submissions ourselves.
import { DailyReportService } from "../services/DailyReportService.js";

const KEY = "dsr_offline_queue";
const CHANGED = "dsr-queue-changed"; // fired when the queue size changes
const SYNCED = "dsr-offline-synced"; // fired after a flush submits item(s)

function read() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full / unavailable — nothing we can safely do here.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export const dsrOfflineQueue = {
  EVENT_CHANGED: CHANGED,
  EVENT_SYNCED: SYNCED,

  getAll: read,
  size() {
    return read().length;
  },

  // One report per day, so a newer submission for the same day REPLACES the
  // queued one — otherwise a flush would fire two upserts for one date.
  add(payload, overrideDate = null) {
    const list = read().filter((x) => (x.overrideDate || null) !== overrideDate);
    list.push({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      queuedAt: Date.now(),
      payload,
      overrideDate,
    });
    write(list);
  },

  remove(id) {
    write(read().filter((x) => x.id !== id));
  },
};

// Try to submit every queued item in order. Stops at the first failure
// (usually means we're still offline) and leaves the rest queued.
export async function flushDsrQueue() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return dsrOfflineQueue.size();
  }
  const list = dsrOfflineQueue.getAll();
  let submittedAny = false;

  for (const item of list) {
    try {
      await DailyReportService.submitFinalReport(
        item.payload,
        item.overrideDate || null,
      );
      dsrOfflineQueue.remove(item.id);
      submittedAny = true;
    } catch (e) {
      console.warn("DSR offline flush stopped (still failing):", e?.message);
      break;
    }
  }

  if (submittedAny) {
    window.dispatchEvent(new Event(SYNCED));
  }
  return dsrOfflineQueue.size();
}
