// src/models/PinPolicy.test.js
//
// The PIN rules live in SQL, where no JavaScript test can execute them. So
// these read the schema text and assert the properties the timesheet depends
// on. A test over source is weaker than a test over behaviour — but the
// alternative here is no test at all, and the property being guarded is one
// that a small, well-meaning edit could remove without anyone noticing.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sql = fs.readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../supabase/timesheet_schema.sql",
  ),
  "utf8",
);

// The body of one function, so an assertion about claim_employee_pin can't be
// satisfied by text sitting in set_employee_pin.
function bodyOf(name) {
  const start = sql.indexOf(`function public.${name}(`);
  expect(start, `${name} is not in the schema`).toBeGreaterThan(-1);
  const end = sql.indexOf("$$;", start);
  return sql.slice(start, end);
}

describe("claim_employee_pin — a first PIN, never a replacement", () => {
  const body = bodyOf("claim_employee_pin");

  it("only writes where no PIN exists", () => {
    // Without this, any staff device could reset a colleague's PIN and then
    // clock hours as them — the one thing the PIN is there to stop.
    expect(body).toMatch(/where\s+id\s*=\s*p_employee_id/i);
    expect(body).toMatch(/and\s+pin_hash\s+is\s+null/i);
  });

  it("refuses a name that has been removed from the roster", () => {
    expect(body).toMatch(/and\s+active/i);
  });

  it("hashes the PIN instead of storing it", () => {
    expect(body).toMatch(/crypt\(\s*p_pin\s*,\s*gen_salt\('bf'\)\s*\)/i);
    expect(body).not.toMatch(/set\s+pin_hash\s*=\s*p_pin/i);
  });

  it("rejects anything that is not 4 to 8 digits", () => {
    expect(body).toMatch(/\^\[0-9\]\{4,8\}\$/);
  });

  it("reports whether the claim actually took", () => {
    // A void function would let the caller assume success on a row that was
    // never written, and unlock the timesheet under someone else's name.
    expect(body).toMatch(/get\s+diagnostics\s+\w+\s*=\s*row_count/i);
    expect(body).toMatch(/returns\s+boolean/i);
  });
});

describe("pgcrypto has to be reachable from inside these functions", () => {
  // This one shipped broken. Supabase installs pgcrypto into the `extensions`
  // schema, `create extension if not exists` leaves it there, and a function
  // pinned to `set search_path = public` then cannot resolve it:
  //     ERROR: function gen_salt(unknown) does not exist
  // Every function that hashes or checks a PIN has to name both schemas.
  for (const fn of ["set_employee_pin", "verify_employee_pin", "claim_employee_pin"]) {
    it(`${fn} can see crypt() and gen_salt()`, () => {
      const body = bodyOf(fn);
      expect(body).toMatch(/set\s+search_path\s*=\s*public,\s*extensions/i);
    });
  }

  it("installs pgcrypto somewhere those functions look", () => {
    expect(sql).toMatch(
      /create\s+extension\s+if\s+not\s+exists\s+pgcrypto\s+with\s+schema\s+extensions/i,
    );
  });
});

describe("set_employee_pin — the admin reset", () => {
  const body = bodyOf("set_employee_pin");

  it("stays admin only", () => {
    // This one CAN overwrite, which is exactly why it is gated.
    expect(body).toMatch(/if\s+not\s+public\.is_admin\(\)/i);
  });
});

describe("employee_has_pin — a boolean and nothing more", () => {
  const body = bodyOf("employee_has_pin");

  it("never returns the hash itself", () => {
    expect(body).toMatch(/pin_hash\s+is\s+not\s+null/i);
    expect(body).not.toMatch(/select\s+pin_hash\s+from/i);
  });
});
