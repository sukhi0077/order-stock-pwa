// src/models/OrderTimestamps.test.js
//
// A policy test over the SQL, because the rule it protects lives in
// save_order() and there is no Postgres in the test environment.
//
// The rule: submitted_at records WHEN a thing was submitted, and must survive
// later edits. It was written as
//     submitted_at = case when p_status = 'submitted' then v_now else ... end
// which re-stamps on every save. An admin correcting a quantity on a submitted
// order sends status='submitted' again to keep it submitted, so the order
// looked freshly placed and its reference — ORD-<date>-<id>, built from
// submitted_at — changed on paperwork the supplier had already received.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const schema = readFileSync(
  fileURLToPath(new URL("../../supabase/schema.sql", import.meta.url)),
  "utf8",
);

// Every assignment to submitted_at / finalized_at in the file, normalised to
// one line so a multi-line CASE can be matched in one go.
function assignmentsTo(column) {
  const flat = schema.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ");
  return [...flat.matchAll(new RegExp(`${column}\\s*=\\s*(case .*?end|[^,;]+)`, "gi"))].map(
    (m) => m[1].trim(),
  );
}

describe("save_order / save_stock_count timestamps", () => {
  it("never re-stamps submitted_at with the current time on an update", () => {
    for (const expr of assignmentsTo("submitted_at")) {
      // The INSERT arm may set it directly; the UPDATE arms must coalesce.
      if (!/case/i.test(expr)) continue;
      expect(expr, expr).toMatch(/coalesce\s*\(\s*[a-z_.]*submitted_at/i);
    }
  });

  it("never re-stamps finalized_at either", () => {
    for (const expr of assignmentsTo("finalized_at")) {
      if (!/case/i.test(expr)) continue;
      expect(expr, expr).toMatch(/coalesce\s*\(\s*[a-z_.]*finalized_at/i);
    }
  });

  it("still stamps a first submission — the column cannot simply be left alone", () => {
    // coalesce(submitted_at, v_now) fills it when null, which is the moment of
    // the first submission. Without v_now in there it would never be set.
    const updates = assignmentsTo("submitted_at").filter((e) => /case/i.test(e));
    expect(updates.length).toBeGreaterThan(0);
    for (const expr of updates) expect(expr, expr).toMatch(/v_now/);
  });

  it("keeps updated_at as the field that moves on every save", () => {
    // The edit still has to be recorded somewhere.
    expect(schema).toMatch(/updated_at\s*=\s*v_now/);
  });
});
