// src/utils/unitScale.js
//
// Sub-unit entry and display.
//
// 91 of the ~270 catalogue items are priced in kg and 18 in ltr, so "a hundred
// grams of saffron" meant typing 0.1 into a phone keypad — the leading zero and
// the decimal point being exactly what gets fumbled mid-service. Quantities are
// still STORED in the base unit (0.1 kg), so stock counts, month-end exports
// and every historical order are untouched; only entry and display change.
//
// Only mass and volume scale. A pack, bottle or jar has no smaller unit that
// means anything, and half a bottle is not something you order.
const SCALE = {
  kg: { small: "g", per: 1000 },
  ltr: { small: "ml", per: 1000 },
  l: { small: "ml", per: 1000 },
};

// Which small unit does this base unit divide into? null when it does not.
export function smallUnitOf(unit) {
  return SCALE[String(unit || "").toLowerCase()]?.small || null;
}

export function isScalable(unit) {
  return smallUnitOf(unit) !== null;
}

function per(unit) {
  return SCALE[String(unit || "").toLowerCase()]?.per || 1;
}

// 0.1 kg -> 100 g. Rounded because 0.1 * 1000 is 100.00000000000001 in binary
// floating point, and a quantity of "100.00000000000001 g" would be absurd.
export function toSmall(qty, unit) {
  return Math.round(Number(qty || 0) * per(unit) * 1000) / 1000;
}

// 100 g -> 0.1 kg. Kept to 3 decimals, matching OrderModel's QTY_DECIMALS, so
// a converted value can never be more precise than the column that stores it.
export function fromSmall(value, unit) {
  return Math.round((Number(value || 0) / per(unit)) * 1000) / 1000;
}

// How a quantity should READ: under one whole unit, say it in the small one.
// 0.1 kg -> "100 g"; 0.35 kg -> "350 g"; 1.4 kg -> "1.4 kg"; 2 kg -> "2 kg".
//
// The threshold is deliberately "less than 1" rather than "not a whole number":
// 1.5 kg is natural as kilos, 1500 g is not.
export function displayQty(qty, unit) {
  const n = Number(qty || 0);
  const small = smallUnitOf(unit);
  if (small && n > 0 && n < 1) return { qty: toSmall(n, unit), unit: small };
  return { qty: n, unit: unit || "" };
}

// The same thing as a single string, for exports and summaries.
export function formatQty(qty, unit) {
  const d = displayQty(qty, unit);
  return `${d.qty} ${d.unit}`.trim();
}

// The step the -/+ buttons should take. Whole units normally; in small mode a
// round 100 g / 100 ml, because that is how kitchens actually count.
export const SMALL_STEP = 100;
