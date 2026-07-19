// src/repositories/ReceiptRepository.js
//
// Receipts are NORMALISED: item_id is a uuid FK to items. The item's name,
// unit, category and sub-category are read by JOINING the catalogue (they are
// no longer copied onto each receipt row), so a rename in the catalogue is
// reflected everywhere automatically.
import { supabase, withTimeout, unwrap, toTs } from "../supabase.js";
import { buildPayload } from "../models/ReceiptModel.js";

const RECEIPTS = "receipts";

// Join the catalogue for the display fields the expiry views need.
const SELECT =
  "*, item:items(name, units!unit_id(code), categories!category_id(name), sub_categories!sub_category_id(name))";

// Persisted payload (camelCase) -> DB row (snake_case). Only the FK + batch data.
function toRow(p) {
  return {
    item_id: p.itemId,
    qty: p.qty,
    expiry: p.expiry,
    reporter: p.reporter,
  };
}

function fromRow(r) {
  return {
    id: r.id,
    itemId: r.item_id || "",
    itemName: r.item?.name || "",
    unit: r.item?.units?.code || "",
    category: r.item?.categories?.name || "",
    subCategory: r.item?.sub_categories?.name || "",
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
          .select(SELECT)
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
