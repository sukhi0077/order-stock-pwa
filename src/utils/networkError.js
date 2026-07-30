// src/utils/networkError.js
//
// "Did this fail because of the network?" — the answer decides whether a save
// is queued for later or thrown away with an alert, so getting it wrong loses
// a day's report.
//
// Browsers word the same failure differently, and the app runs on iPhones:
//   Safari / iOS   TypeError: Load failed
//   Chrome         TypeError: Failed to fetch
//   Firefox        TypeError: NetworkError when attempting to fetch resource
// Matching only on "fetch" — as this once did — silently excluded every Safari
// user, which is most of them.
const NETWORK_MESSAGE =
  /load failed|failed to fetch|network|networkerror|timed out|timeout|unavailable|offline|connection|aborted/i;

export function isNetworkError(error) {
  if (!error) return false;
  // The browser is telling us outright.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  // Set by the repositories, which wrap the original error and would otherwise
  // lose its type.
  if (error.isNetwork) return true;
  // A rejected fetch is always a TypeError, whatever the wording.
  if (error instanceof TypeError) return true;
  return NETWORK_MESSAGE.test(error.message || "");
}

// Wrap a caught error for rethrowing without losing whether it was a network
// failure — `new Error(err.message)` drops the TypeError-ness that
// isNetworkError relies on.
export function asAppError(error, fallbackMessage) {
  const e = new Error(error?.message || fallbackMessage);
  e.isNetwork = isNetworkError(error);
  e.cause = error;
  return e;
}
