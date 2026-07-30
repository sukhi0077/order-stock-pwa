// src/utils/networkError.test.js
//
// This decides whether a failed save is queued or thrown away, so the browser
// wordings are pinned explicitly. The bug it exists to prevent: Safari says
// "Load failed", the old check only matched "fetch", and every iPhone save
// during a network blip was lost with an alert.
import { describe, it, expect, afterEach, vi } from "vitest";
import { isNetworkError, asAppError } from "./networkError.js";

// navigator.onLine is consulted first; keep it out of the way unless a test
// is specifically about it.
const setOnline = (value) => {
  vi.stubGlobal("navigator", { onLine: value });
};
afterEach(() => vi.unstubAllGlobals());

describe("isNetworkError — browser wordings", () => {
  setOnline(true);

  it("recognises Safari and iOS", () => {
    setOnline(true);
    expect(isNetworkError(new TypeError("Load failed"))).toBe(true);
  });

  it("recognises Chrome", () => {
    setOnline(true);
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("recognises Firefox", () => {
    setOnline(true);
    expect(isNetworkError(new TypeError("NetworkError when attempting to fetch resource."))).toBe(
      true,
    );
  });

  it("recognises our own timeout wrapper", () => {
    setOnline(true);
    expect(isNetworkError(new Error("Saving report timed out. Check your connection."))).toBe(true);
  });

  it("treats any TypeError as network — a rejected fetch always is one", () => {
    setOnline(true);
    // Even if a future browser invents new wording.
    expect(isNetworkError(new TypeError("some new wording"))).toBe(true);
  });
});

describe("isNetworkError — what it must NOT swallow", () => {
  it("leaves a database error alone, so it is surfaced not silently queued", () => {
    setOnline(true);
    expect(
      isNetworkError(new Error('invalid input syntax for type timestamp with time zone: "1"')),
    ).toBe(false);
  });

  it("leaves a permission error alone", () => {
    setOnline(true);
    expect(isNetworkError(new Error("new row violates row-level security policy"))).toBe(false);
  });

  it("is false for nothing at all", () => {
    setOnline(true);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});

describe("isNetworkError — the browser says we are offline", () => {
  it("is true whatever the error says", () => {
    setOnline(false);
    expect(isNetworkError(new Error("anything at all"))).toBe(true);
  });
});

describe("asAppError", () => {
  it("keeps the network verdict across the rewrap that would otherwise lose it", () => {
    setOnline(true);
    // The repository catches a TypeError and rethrows a plain Error; without
    // the flag the caller could no longer tell it was a network failure.
    const wrapped = asAppError(new TypeError("Load failed"), "Failed to save report.");
    expect(wrapped).toBeInstanceOf(Error);
    expect(wrapped).not.toBeInstanceOf(TypeError);
    expect(isNetworkError(wrapped)).toBe(true);
  });

  it("does not mark a database error as network", () => {
    setOnline(true);
    const wrapped = asAppError(new Error("duplicate key value"), "Failed to save report.");
    expect(isNetworkError(wrapped)).toBe(false);
  });

  it("keeps the original message, falling back when there is none", () => {
    setOnline(true);
    expect(asAppError(new Error("boom"), "fallback").message).toBe("boom");
    expect(asAppError({}, "fallback").message).toBe("fallback");
  });

  it("keeps the original error as the cause, for debugging", () => {
    setOnline(true);
    const original = new TypeError("Load failed");
    expect(asAppError(original, "x").cause).toBe(original);
  });
});
