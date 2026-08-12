// src/i18n/i18n.test.js
//
// A missing key doesn't throw — it renders as the key itself, so a Hindi phone
// quietly shows "ts_choosePin" where a sentence should be. That is exactly the
// kind of bug nobody reports, because the person seeing it assumes the app is
// meant to look like that. So the two dictionaries are compared directly.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "i18n.jsx"),
  "utf8",
);

// Read the keys straight from the file rather than importing the module: the
// dictionaries live inside a JSX component file that pulls in React, and this
// test is about the text, not the rendering.
function keysFor(lang) {
  const blocks = source.split(/^\s{2}(en|hi):\s*\{/m);
  for (let i = 1; i < blocks.length; i += 2) {
    if (blocks[i] === lang) {
      return new Set(
        [...blocks[i + 1].matchAll(/^\s{4}([a-zA-Z_][\w]*)\s*:/gm)].map((m) => m[1]),
      );
    }
  }
  return new Set();
}

describe("translations", () => {
  const en = keysFor("en");
  const hi = keysFor("hi");

  it("finds both dictionaries", () => {
    expect(en.size).toBeGreaterThan(100);
    expect(hi.size).toBeGreaterThan(100);
  });

  it("says the same things in both languages", () => {
    expect([...en].filter((k) => !hi.has(k))).toEqual([]);
    expect([...hi].filter((k) => !en.has(k))).toEqual([]);
  });

  it("has the first-run PIN wording in both", () => {
    for (const key of [
      "ts_choosePin",
      "ts_confirmPin",
      "ts_choosePinHint",
      "ts_savePin",
      "ts_pinTooShort",
      "ts_pinMismatch",
      "ts_pinAlreadySet",
    ]) {
      expect(en.has(key), `English is missing ${key}`).toBe(true);
      expect(hi.has(key), `Hindi is missing ${key}`).toBe(true);
    }
  });
});
