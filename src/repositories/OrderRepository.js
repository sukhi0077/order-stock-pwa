// src/repositories/OrderRepository.js
//
// An order is now NORMALISED: a header row in `orders` plus one row per item in
// `order_lines` (qty + note). The app still works with a `lines` map
// (itemId -> { qty, note }), so this repository translates between them:
//   - READS rebuild the map from order_lines.
//   - WRITES go through the save_order() RPC, which inserts/updates the header
//     and replaces the lines in one atomic, RLS-enforcing transaction.
import { supabase, withTimeout, unwrap, toTs } from "../supabase.js";
import { buildPayload } from "../models/OrderModel.js";

const ORDERS = "orders";
const LINES = "order_lines"; // (order_id, item_id, qty, note)

function fromRow(r, lines = {}) {
  if (!r) return null;
  return {
    id: r.id,
    reporter: r.reporter || "",
    status: r.status || "draft",
    lines: lines || {},
    createdAt: toTs(r.created_at),
    updatedAt: toTs(r.updated_at),
    submittedAt: toTs(r.submitted_at),
  };
}

// Fetch one order's lines as a { itemId: { qty, note } } map.
async function linesForOrder(orderId) {
  const rows = unwrap(
    await withTimeout(
      supabase.from(LINES).select("item_id, qty, note").eq("order_id", orderId),
      15000,
      "Loading order",
    ),
    "Loading order",
  );
  const map = {};
  for (const row of rows || []) map[row.item_id] = { qty: Number(row.qty), note: row.note || "" };
  return map;
}

// Fetch lines for several orders at once -> { orderId: { itemId: {qty,note} } }.
async function linesForOrders(orderIds) {
  if (!orderIds.length) return {};
  const rows = unwrap(
    await withTimeout(
      supabase.from(LINES).select("order_id, item_id, qty, note").in("order_id", orderIds),
      15000,
      "Loading orders",
    ),
    "Loading orders",
  );
  const byOrder = {};
  for (const row of rows || []) {
    (byOrder[row.order_id] ||= {})[row.item_id] = { qty: Number(row.qty), note: row.note || "" };
  }
  return byOrder;
}

// Persist an order (create when orderId is null) via the atomic RPC; returns id.
async function saveViaRpc({ orderId, reporter, status, lines }) {
  const payload = buildPayload({ reporter, status, lines });
  const id = unwrap(
    await withTimeout(
      supabase.rpc("save_order", {
        p_order_id: orderId || null,
        p_reporter: payload.reporter,
        p_status: payload.status,
        p_lines: payload.lines,
      }),
      20000,
      "Saving order",
    ),
    "Saving order",
  );
  return { id };
}

export class OrderRepository {
  // The single running draft (status == 'draft'), or null.
  static async getDraft() {
    const rows = unwrap(
      await withTimeout(
        supabase.from(ORDERS).select("*").eq("status", "draft").limit(1),
        15000,
        "Loading order",
      ),
      "Loading order",
    );
    if (!rows || !rows.length) return null;
    const lines = await linesForOrder(rows[0].id);
    return fromRow(rows[0], lines);
  }

  static async getById(orderId) {
    const header = unwrap(
      await withTimeout(
        supabase.from(ORDERS).select("*").eq("id", orderId).maybeSingle(),
        15000,
        "Loading order",
      ),
      "Loading order",
    );
    if (!header) return null;
    const lines = await linesForOrder(orderId);
    return fromRow(header, lines);
  }

  // Create a new order (used to start a fresh draft).
  static async create({ reporter, status, lines }) {
    return saveViaRpc({ orderId: null, reporter, status, lines });
  }

  // Update an existing order's lines / status.
  static async update(orderId, { reporter, status, lines }) {
    return saveViaRpc({ orderId, reporter, status, lines });
  }

  // Create-or-update the running draft in one call.
  static async saveDraft({ orderId, reporter, status, lines }) {
    return saveViaRpc({ orderId: orderId || null, reporter, status, lines });
  }

  // All orders, newest first (admin list).
  static async list(limitCount = 100) {
    const headers = unwrap(
      await withTimeout(
        supabase
          .from(ORDERS)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limitCount),
        15000,
        "Loading orders",
      ),
      "Loading orders",
    );
    const byOrder = await linesForOrders((headers || []).map((h) => h.id));
    return (headers || []).map((h) => fromRow(h, byOrder[h.id] || {}));
  }
}
