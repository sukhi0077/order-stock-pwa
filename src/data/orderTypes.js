// src/data/orderTypes.js
// The FIXED list of order types an admin can assign to an item in Manage Items.
// Stored on items.order_type as plain text (no master table), so editing this
// list is a code change — existing items keep whatever value they already have,
// even if it is later removed from this list.
export const ORDER_TYPES = [
  "Makro",
  "Indian",
  "Vegetable",
  "Manual",
  "Miejczysto",
  "Cola",
  "Beer",
];
