// src/repositories/OrderRepository.js
import { supabase, withTimeout, unwrap, toTs } from "../supabase.js";
import { buildPayload } from "../models/OrderModel.js";

const ORDERS = "orders";

function fromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    reporter: r.reporter || "",
    status: r.status || "draft",
    lines: r.lines || {},
    createdAt: toTs(r.created_at),
    updatedAt: toTs(r.updated_at),
    submittedAt: toTs(r.submitted_at),
  };
}

export class OrderRepository {
  // The single running draft (status == 'draft'), or null.
  static async getDraft() {
    const data = unwrap(
      await withTimeout(
        supabase.from(ORDERS).select("*").eq("status", "draft").limit(1),
        15000,
        "Loading order",
      ),
      "Loading order",
    );
    return data && data.length ? fromRow(data[0]) : null;
  }

  static async getById(orderId) {
    const data = unwrap(
      await withTimeout(
        supabase.from(ORDERS).select("*").eq("id", orderId).maybeSingle(),
        15000,
        "Loading order",
      ),
      "Loading order",
    );
    return fromRow(data);
  }

  // Create a new order (used to start a fresh draft).
  static async create({ reporter, status, lines }) {
    const payload = buildPayload({ reporter, status, lines });
    const now = new Date().toISOString();
    const row = {
      reporter: payload.reporter,
      status: payload.status,
      lines: payload.lines,
      updated_at: now,
      ...(status === "submitted" ? { submitted_at: now } : {}),
    };
    const data = unwrap(
      await withTimeout(
        supabase.from(ORDERS).insert(row).select("id").single(),
        20000,
        "Saving order",
      ),
      "Saving order",
    );
    return { id: data.id };
  }

  // Update an existing order's lines / status.
  static async update(orderId, { reporter, status, lines }) {
    const payload = buildPayload({ reporter, status, lines });
    const now = new Date().toISOString();
    const row = {
      reporter: payload.reporter,
      status: payload.status,
      lines: payload.lines,
      updated_at: now,
      ...(status === "submitted" ? { submitted_at: now } : {}),
    };
    unwrap(
      await withTimeout(
        supabase.from(ORDERS).update(row).eq("id", orderId),
        20000,
        "Saving order",
      ),
      "Saving order",
    );
    return { id: orderId };
  }

  // Create-or-update the running draft in one call.
  static async saveDraft({ orderId, reporter, status, lines }) {
    if (orderId) return OrderRepository.update(orderId, { reporter, status, lines });
    return OrderRepository.create({ reporter, status, lines });
  }

  // All orders, newest first (admin list).
  static async list(limitCount = 100) {
    const data = unwrap(
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
    return (data || []).map(fromRow);
  }
}
