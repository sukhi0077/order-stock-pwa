// src/theme/themes.test.js
import { describe, it, expect } from "vitest";
import {
  THEMES,
  SECTIONS,
  DEFAULT_THEME,
  getTheme,
  accentVars,
  neutralVars,
  swatchesFor,
  hueHex,
} from "./themes.js";

const ALL_SECTIONS = ["orders", "receive", "stock", "dsr", "admin"];
const HEX = /^#[0-9a-f]{6}$/i;

describe("THEMES", () => {
  it("offers exactly the three schemes the picker shows", () => {
    expect(Object.keys(THEMES)).toEqual(["classic", "ocean", "midnight"]);
  });

  it("gives every scheme a hue for every section", () => {
    for (const th of Object.values(THEMES)) {
      for (const s of ALL_SECTIONS) {
        expect(th[s], `${th.id}.${s}`).toBeDefined();
        expect(typeof th[s].hue).toBe("string");
      }
    }
  });

  it("declares its neutral mode, and only Midnight is dark", () => {
    expect(THEMES.classic.neutrals).toBe("light");
    expect(THEMES.ocean.neutrals).toBe("light");
    expect(THEMES.midnight.neutrals).toBe("dark");
  });

  it("keeps every scheme's id matching its key, so the saved value round-trips", () => {
    for (const [key, th] of Object.entries(THEMES)) expect(th.id).toBe(key);
  });

  it("uses a hue that actually has a colour ramp", () => {
    for (const th of Object.values(THEMES))
      for (const s of ALL_SECTIONS)
        expect(hueHex(th[s].hue), `${th.id}.${s}`).toMatch(HEX);
  });
});

describe("getTheme", () => {
  it("returns the requested scheme", () => {
    expect(getTheme("ocean").id).toBe("ocean");
  });

  it("falls back rather than returning undefined for an unknown or removed id", () => {
    // "graphite" was removed; anyone who had it selected must not break.
    expect(getTheme("graphite").id).toBe(DEFAULT_THEME);
    expect(getTheme(undefined).id).toBe(DEFAULT_THEME);
    expect(getTheme("").id).toBe(DEFAULT_THEME);
  });
});

describe("accentVars", () => {
  it("emits the full --accent-* ramp as hex", () => {
    const v = accentVars("teal");
    expect(Object.keys(v)).toEqual([
      "--accent-50", "--accent-100", "--accent-200", "--accent-300", "--accent-400",
      "--accent-500", "--accent-600", "--accent-700", "--accent-800", "--accent-900",
    ]);
    for (const hex of Object.values(v)) expect(hex).toMatch(HEX);
  });

  it("falls back to teal for an unknown hue instead of producing undefined", () => {
    expect(accentVars("chartreuse")).toEqual(accentVars("teal"));
  });

  it("gives different hues different values", () => {
    expect(accentVars("teal")["--accent-600"]).not.toBe(accentVars("indigo")["--accent-600"]);
  });
});

describe("neutralVars", () => {
  it("emits the full --n-* ramp, including n-0", () => {
    const v = neutralVars("light");
    expect(Object.keys(v)).toHaveLength(11);
    expect(v["--n-0"]).toBe("#ffffff");
    for (const hex of Object.values(v)) expect(hex).toMatch(HEX);
  });

  it("inverts for the dark ramp: the card surface is dark and the text is light", () => {
    const light = neutralVars("light");
    const dark = neutralVars("dark");
    // n-0 is the card surface, n-900 the primary text.
    expect(dark["--n-0"]).not.toBe(light["--n-0"]);
    expect(brightness(dark["--n-0"])).toBeLessThan(brightness(light["--n-0"]));
    expect(brightness(dark["--n-900"])).toBeGreaterThan(brightness(light["--n-900"]));
  });

  it("reproduces the standalone dsr-pwa palette exactly", () => {
    // Taken from that app's markup, not approximated: page bg-slate-900,
    // cards bg-slate-800, border-slate-700 hairlines, text-slate-300 body,
    // text-slate-100 headings.
    const dark = neutralVars("dark");
    expect(dark["--n-50"]).toBe("#0f172a"); // slate-900 — page
    expect(dark["--n-0"]).toBe("#1e293b"); // slate-800 — card
    expect(dark["--n-200"]).toBe("#334155"); // slate-700 — hairline
    expect(dark["--n-700"]).toBe("#cbd5e1"); // slate-300 — body text
    expect(dark["--n-900"]).toBe("#f1f5f9"); // slate-100 — headings
  });

  it("puts cards LIGHTER than the page in the dark ramp, unlike the light one", () => {
    const dark = neutralVars("dark");
    const light = neutralVars("light");
    expect(brightness(dark["--n-0"])).toBeGreaterThan(brightness(dark["--n-50"]));
    expect(brightness(light["--n-0"])).toBeGreaterThan(brightness(light["--n-50"]));
  });

  it("falls back to light for an unknown mode", () => {
    expect(neutralVars("sepia")).toEqual(neutralVars("light"));
  });
});

describe("swatchesFor", () => {
  it("returns one hex per home tile, in tile order", () => {
    for (const th of Object.values(THEMES)) {
      const sw = swatchesFor(th);
      expect(sw).toHaveLength(SECTIONS.length);
      for (const hex of sw) expect(hex).toMatch(HEX);
    }
  });
});

describe("hueHex", () => {
  it("defaults to the 600 shade and honours an explicit one", () => {
    expect(hueHex("teal")).toBe("#0d9488");
    expect(hueHex("teal", 50)).toBe("#f0fdfa");
  });

  it("does not return undefined for a shade outside the ramp", () => {
    expect(hueHex("teal", 42)).toMatch(HEX);
  });
});

// Perceived brightness, enough to assert "darker than".
function brightness(hex) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
}
