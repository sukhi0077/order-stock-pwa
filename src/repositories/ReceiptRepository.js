// src/repositories/ReceiptRepository.js
import { supabase, withTimeout, unwrap, toTs } from "../supabase.js";
import { buildPayload } from "../models/ReceiptModel.js";

const RECEIPTS = "receipts";

// Persisted payload (camelCase, item fields denormalized) -> DB row (snake_case).
function toRow(p) {
  return {
    item_id: p.itemId,
    item_name: p.itemName,
    unit: p.unit,
    category: p.category,
    sub_category: p.subCategory,
    qty: p.qty,
    expiry: p.expiry,
    reporter: p.reporter,
  };
}

function fromRow(r) {
  return {
    id: r.id,
    itemId: r.item_id || "",
    itemName: r.item_name || "",
    unit: r.unit || "",
    category: r.category || "",
    subCategory: r.sub_category || "",
    qty: Number(r.qty) || 0,
    expiry: r.expiry || "",
    reporter: r.reporter || "",
    receivedAt: toTs(r.received_at),
  };
}

export class ReceiptRepository {
  // Add one received batch.
  static async add({ item, qty, expiry, reporter }) {
    const row = toRow(buildPayload({ item, qty, expiry, reporter }));
    const data = unwrap(
      await withTimeout(
        supabase.from(RECEIPTS).insert(row).select("id").single(),
        15000,
        "Saving receipt",
      ),
      "Saving receipt",
    );
    return { id: data.id };
  }

  // All receipts, soonest expiry first.
  static async list(limitCount = 1000) {
    const data = unwrap(
      await withTimeout(
        supabase
          .from(RECEIPTS)
          .select("*")
          .order("expiry", { ascending: true })
          .limit(limitCount),
        15000,
        "Loading receipts",
      ),
      "Loading receipts",
    );
    return (data || []).map(fromRow);
  }

  // Delete a batch (mistake, or once consumed).
  static async remove(id) {
    unwrap(
      await withTimeout(
        supabase.from(RECEIPTS).delete().eq("id", id),
        15000,
        "Deleting receipt",
      ),
      "Deleting receipt",
    );
    return true;
  }
}
