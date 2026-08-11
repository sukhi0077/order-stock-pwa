// src/models/DailyReportModel.js
//
// Pure business logic for the Daily Sale Report — no I/O, no React.
//
// PORTED FROM dsr-pwa, with two shape changes for the Supabase schema:
//   * couponsGivenCount (the free-text "Anna - 4, Marek - 5" string) is now
//     couponsGiven: [{ employeeId, name, count }] — real FKs, not parsed text.
//   * reporter (free text) is now reporterId, chosen from the employee list.
// The legacy parser is kept (parseCouponsGiven) purely so the Firestore data
// import can convert the old strings when that migration runs.

// Delivery platforms are loaded from the database (public.delivery_platforms).
// This is only the fallback used before that query resolves.
export const FALLBACK_PLATFORMS = [
  "Uber",
  "Bolt",
  "Wolt",
  "Glovo",
  "Pyszne",
  "RePOS",
];

// Helper to safely parse numbers, reject NaN, and treat empty strings as 0 in math
const safeNum = (val) => {
  if (val === "" || val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

// Round to 2 decimal places, avoiding floating-point drift (e.g. 0.1 + 0.2).
const round2 = (num) => Math.round((Number(num) + Number.EPSILON) * 100) / 100;

// Build a complete delivery object, preserving any existing values.
// Guards against old drafts/reports saved before a platform was added.
const buildDelivery = (existing = {}, platforms = FALLBACK_PLATFORMS) =>
  platforms.reduce((acc, platform) => {
    const prev = existing[platform] || {};
    acc[platform] = {
      online: prev.online ?? "",
      cash: prev.cash ?? "",
      card: prev.card ?? "",
    };
    return acc;
  }, {});

export class DailyReportModel {
  // ---- Google-review coupons, per employee --------------------------------
  // Stored as one row per employee per day in dsr_coupons (kind = 'given').
  // In the form they live as [{ employeeId, name, count }].

  // LEGACY: parse "Name - 4, Name2 - 5" -> [{ name, count }].
  // Only used by the Firestore data import. Tolerant of the old free-text
  // format: it takes the LAST number in each comma-separated chunk as the
  // count and everything before it as the name.
  static parseCouponsGiven(str) {
    return String(str || "")
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part !== "")
      .map((part) => {
        const nums = part.match(/\d+(?:\.\d+)?/g);
        const count = nums ? Number(nums[nums.length - 1]) : 0;
        let name = part;
        if (nums) {
          const last = nums[nums.length - 1];
          const at = part.lastIndexOf(last);
          name = part.slice(0, at).replace(/[-:\s]+$/, "").trim();
        }
        return { name, count };
      })
      .filter((e) => e.name !== "");
  }

  // Keep only entries with a positive count — what actually gets persisted.
  static cleanCouponsGiven(entries) {
    return (entries || [])
      .filter((e) => e && e.employeeId && safeNum(e.count) > 0)
      .map((e) => ({
        employeeId: e.employeeId,
        qty: Math.round(safeNum(e.count)),
      }));
  }

  // Google-review coupon counts may only be added/edited on the report's own
  // day (today). Past reports are locked for coupon editing — this matches the
  // save_dsr_report RPC (which silently skips 'given' rows on a backdated
  // save) and prevents back-dating coupon counts.
  static canEditCoupons(reportDateString, todayString) {
    return (
      !!reportDateString &&
      !!todayString &&
      String(reportDateString) === String(todayString)
    );
  }

  // Sum coupons-given across many rows into a sorted breakdown.
  // Accepts rows from public.v_coupon_counts ({ employee_name, qty }) or the
  // in-form shape ({ name, count }). Returns [{ name, count }] sorted by
  // count desc, then name.
  static aggregateCouponsByStaff(rows) {
    const totals = {};
    for (const r of rows || []) {
      if (!r) continue;
      const name = String(r.employee_name ?? r.name ?? "").trim();
      if (!name) continue;
      totals[name] = (totals[name] || 0) + safeNum(r.qty ?? r.count);
    }
    return Object.entries(totals)
      .map(([name, count]) => ({ name, count: round2(count) }))
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  // Normalize any loaded data (draft or DB report) so every current platform
  // exists in delivery. Returns a new object safe for the form to use.
  static normalize(data, platforms = FALLBACK_PLATFORMS) {
    if (!data) return DailyReportModel.getInitialState(platforms);
    return {
      ...DailyReportModel.getInitialState(platforms),
      ...data,
      delivery: buildDelivery(data.delivery, platforms),
      couponsGiven: Array.isArray(data.couponsGiven) ? data.couponsGiven : [],
      // A saved draft carries the tick; a report loaded from the database does
      // not, because the database stores the amount and not how it was
      // arrived at. So an existing report opens as a typed figure. Inheriting
      // the fresh-form default of `true` would be worse than wrong: it would
      // re-derive a number somebody already checked and signed off.
      morningCashAuto: data.morningCashAuto ?? false,
    };
  }

  static getInitialState(platforms = FALLBACK_PLATFORMS) {
    return {
      totalSalePOS: "",
      isMatchingFiskalne: "",
      // Manually entered online sale figure from the POS (cross-checked against
      // the auto-calculated delivery breakdown total).
      onlineSalePOS: "",
      delivery: buildDelivery({}, platforms),
      cardSalePOS: "",
      isMatchingING: "",
      cashSalePOS: "",
      cashFromYesterday: "",
      // Counted in the box first thing today. Recorded, not calculated with —
      // see cleanPayloadForDatabase and calculateExpectedCash.
      morningCash: "",
      // Tick means "the box held exactly what yesterday closed on", which is
      // the ordinary morning. Nothing is copied into morningCash while it is
      // ticked: the figure is resolved at save time, so a late correction to
      // yesterday's cash — the concurrency check does exactly that — carries
      // through instead of leaving a stale copy behind.
      morningCashAuto: true,
      cashTakenList: [],
      cashAddedList: [],
      totalCashInBox: "",
      receivedCoupons: "",
      couponsDetails: [],
      // Google-review coupons GIVEN today: [{ employeeId, name, count }]
      couponsGiven: [],
      comments: "",
      // The employee who filed the report (picked from a dropdown).
      reporterId: "",
    };
  }

  // What actually gets stored as this morning's cash.
  //
  // Ticked, it is yesterday's closing figure, read at save time rather than
  // copied when the box was ticked. Unticked, it is whatever was typed.
  //
  // Optional either way: an empty box stays null rather than becoming 0, so an
  // unanswered question stays distinguishable from a counted empty till.
  // Only an explicit `true` mirrors — anything else is treated as typed, so a
  // caller that knows nothing about the tick keeps the old behaviour.
  static resolveMorningCash(data) {
    const source =
      data?.morningCashAuto === true ? data?.cashFromYesterday : data?.morningCash;
    return String(source ?? "").trim() === "" ? null : round2(safeNum(source));
  }

  // How far this morning's count is from yesterday's closing cash.
  //
  // Positive means more in the box than last night left, negative means less.
  // Null when there is nothing to compare: while the tick is on the two are
  // the same figure by definition, and before either number is known a "0.00"
  // would be a claim rather than a measurement.
  static morningCashDiff(data) {
    if (data?.morningCashAuto === true) return null;
    const typed = String(data?.morningCash ?? "").trim();
    const yesterday = String(data?.cashFromYesterday ?? "").trim();
    if (typed === "" || yesterday === "") return null;
    return round2(safeNum(typed) - safeNum(yesterday));
  }

  static calculateOnlineSale(deliveryData) {
    let sum = 0;
    Object.values(deliveryData || {}).forEach((d) => {
      sum += safeNum(d?.cash) + safeNum(d?.online) + safeNum(d?.card);
    });
    return round2(sum);
  }

  // Sum of just the "online" column across portals (for the bank-transfer check).
  static calculateDeliveryOnline(deliveryData) {
    let sum = 0;
    Object.values(deliveryData || {}).forEach((d) => {
      sum += safeNum(d?.online);
    });
    return round2(sum);
  }

  static calculateExpectedCash(yesterday, cashPos, cashTakenList, cashAddedList) {
    // NOTE: delivery cash is NOT added here — it is already part of the
    // Cash Sale (cashPos) entered in card 1, so adding it would double-count.
    let totalCashTaken = 0;
    (cashTakenList || []).forEach((item) => {
      totalCashTaken += safeNum(item.amount);
    });
    let totalCashAdded = 0;
    (cashAddedList || []).forEach((item) => {
      totalCashAdded += safeNum(item.amount);
    });

    return round2(
      safeNum(yesterday) + safeNum(cashPos) + totalCashAdded - totalCashTaken,
    );
  }

  static getCommentRequirements(
    cashMismatch,
    isMatchingFiskalne,
    isMatchingING,
    onlineSaleMismatch,
  ) {
    const reasons = [];
    if (cashMismatch) reasons.push("Cash Difference");
    if (isMatchingFiskalne === "No") reasons.push("Fiskalne Mismatch");
    if (isMatchingING === "No") reasons.push("ING Mismatch");
    if (onlineSaleMismatch) reasons.push("Bank Transfer vs Portals");
    return reasons;
  }

  static validate(data, isCommentRequired) {
    const errors = {};

    // 1. Math & Numeric Validation for POS
    if (!data.totalSalePOS || String(data.totalSalePOS).trim() === "") {
      errors.totalSalePOS =
        "Oops! The till needs a total, or the math wizards will cry! 🧙‍♂️✨";
    } else if (safeNum(data.totalSalePOS) < 0) {
      errors.totalSalePOS =
        "Whoa there, time traveler! We can't have negative sales unless we're paying people to eat here! 🍔💸";
    } else {
      const expectedTotal =
        safeNum(data.onlineSalePOS) +
        safeNum(data.cardSalePOS) +
        safeNum(data.cashSalePOS);
      // Math.abs handles floating point rounding errors
      if (Math.abs(safeNum(data.totalSalePOS) - expectedTotal) > 0.01) {
        errors.totalSalePOS = `Math magic alert! 🪄 Online + Card + Cash equals ${expectedTotal.toFixed(2)}. Let's make the numbers hold hands and agree!`;
      }
    }

    if (!data.isMatchingFiskalne)
      errors.isMatchingFiskalne =
        "Fiskalne is feeling ignored! Give it a 'Yes' or 'No' high-five! 🙌";

    if (data.cardSalePOS === "" || safeNum(data.cardSalePOS) < 0)
      errors.cardSalePOS =
        "Did the card machine take a nap? 💤 We need those card sales, please!";
    if (data.onlineSalePOS === "" || safeNum(data.onlineSalePOS) < 0)
      errors.onlineSalePOS =
        "Don't forget the bank transfer sales! 🏦 Enter the amount (0 is fine).";
    if (!data.isMatchingING)
      errors.isMatchingING =
        "ING is waiting for your verdict! Thumbs up or thumbs down? 👍👎";

    if (data.cashSalePOS === "" || safeNum(data.cashSalePOS) < 0)
      errors.cashSalePOS =
        "Show me the money! 💵 (Literally, we need the cash POS amount!)";
    else {
      // Delivery cash is part of the Cash Sale, so it can't be larger than it.
      let deliveryCashSum = 0;
      Object.values(data.delivery || {}).forEach((d) => {
        deliveryCashSum += safeNum(d?.cash);
      });
      if (deliveryCashSum - safeNum(data.cashSalePOS) > 0.01) {
        errors.cashSalePOS = `Delivery cash (${deliveryCashSum.toFixed(2)}) can't be more than Cash Sale. Check the delivery breakdown!`;
      }
    }
    if (data.totalCashInBox === "" || safeNum(data.totalCashInBox) < 0)
      errors.totalCashInBox =
        "Time to count the treasure! 🏴‍☠️ How much actual cash is in the box?";

    // 2. Reporter is now a dropdown choice, not free text.
    if (!data.reporterId)
      errors.reporterId =
        "Who is the mystery hero submitting this report? 🦸‍♀️🦸‍♂️ Pick your name!";

    if (
      isCommentRequired &&
      (!data.comments || String(data.comments).trim() === "")
    ) {
      errors.comments =
        "Plot twist! We have a mismatch. Grab your magnifying glass 🔍 and tell us the story in the comments!";
    }

    // 3. Dynamic List Fixes (Cash Taken)
    (data.cashTakenList || []).forEach((item, idx) => {
      const amountStr = String(item.amount).trim();
      const reasonStr = String(item.reason || "").trim();

      // Only validate if they typed something (ignore completely blank Ghost Rows)
      if (amountStr !== "" || reasonStr !== "") {
        const amt = safeNum(amountStr);
        if (amt <= 0)
          errors[`cashTaken_${idx}_amount`] =
            "You can't take zero cash! Well, you can, but then you don't need this box! 😅";
        if (reasonStr === "")
          errors[`cashTaken_${idx}_reason`] =
            "Spill the tea! ☕ Why did the cash leave the box?";
      }
    });

    // 3b. Dynamic List Fixes (Cash Added)
    (data.cashAddedList || []).forEach((item, idx) => {
      const amountStr = String(item.amount).trim();
      const reasonStr = String(item.reason || "").trim();
      if (amountStr !== "" || reasonStr !== "") {
        const amt = safeNum(amountStr);
        if (amt <= 0)
          errors[`cashAdded_${idx}_amount`] =
            "Add an amount greater than zero, or remove the row. 😅";
        if (reasonStr === "")
          errors[`cashAdded_${idx}_reason`] =
            "Where did this extra cash come from? ☕";
      }
    });

    // 4. Coupons Validation
    if (!data.receivedCoupons) {
      errors.receivedCoupons =
        "Did anyone bring us magical discount tickets today? 🎟️ Let us know!";
    } else if (data.receivedCoupons === "Yes") {
      if (!data.couponsDetails || data.couponsDetails.length === 0) {
        errors.discountCoupons =
          "Please add at least one coupon — tap “+ Add Coupon”. 🎫";
      } else {
        data.couponsDetails.forEach((c, idx) => {
          const pctStr = String(c.percentage).trim();
          const orderStr = String(c.posOrderNumber || "").trim();
          const pct = safeNum(pctStr);

          if (pctStr === "" || pct <= 0 || pct > 100) {
            errors[`coupon_${idx}_percentage`] =
              "Unless this coupon breaks the laws of physics, it needs to be between 1 and 100! 🌌";
          }
          if (orderStr === "") {
            errors[`coupon_${idx}_posOrderNumber`] =
              "We need the POS Order Number to prove this coupon isn't a ghost! 👻";
          }
        });
      }
    }

    return errors;
  }

  // 5. Clean payload — the shape the repository maps onto the RPC arguments.
  //    Derived totals are NOT included: they are computed by the
  //    v_dsr_report_totals view in Postgres and live here only for the UI.
  static cleanPayloadForDatabase(data) {
    return {
      reporterId: data.reporterId,
      comments: data.comments ? String(data.comments).trim() : "",

      totalSalePOS: round2(safeNum(data.totalSalePOS)),
      cardSalePOS: round2(safeNum(data.cardSalePOS)),
      cashSalePOS: round2(safeNum(data.cashSalePOS)),
      onlineSalePOS: round2(safeNum(data.onlineSalePOS)),
      totalCashInBox: round2(safeNum(data.totalCashInBox)),
      cashFromYesterday: round2(safeNum(data.cashFromYesterday)),

      isMatchingFiskalne: data.isMatchingFiskalne,
      isMatchingING: data.isMatchingING,
      receivedCoupons: data.receivedCoupons,

      // Normalize every per-platform delivery figure to 2 decimals too.
      delivery: Object.fromEntries(
        Object.entries(data.delivery || {}).map(([p, d]) => [
          p,
          {
            online: round2(safeNum(d?.online)),
            cash: round2(safeNum(d?.cash)),
            card: round2(safeNum(d?.card)),
          },
        ]),
      ),

      morningCash: DailyReportModel.resolveMorningCash(data),

      cashTakenList: (data.cashTakenList || [])
        .filter(
          (item) =>
            String(item.amount).trim() !== "" ||
            (item.reason && String(item.reason).trim() !== ""),
        )
        .map((item) => ({
          amount: round2(safeNum(item.amount)),
          reason: String(item.reason).trim(),
          ...(item.seq != null ? { seq: item.seq } : {}),
        })),

      cashAddedList: (data.cashAddedList || [])
        .filter(
          (item) =>
            String(item.amount).trim() !== "" ||
            (item.reason && String(item.reason).trim() !== ""),
        )
        .map((item) => ({
          amount: round2(safeNum(item.amount)),
          reason: String(item.reason).trim(),
          ...(item.seq != null ? { seq: item.seq } : {}),
        })),

      couponsDetails:
        data.receivedCoupons === "Yes"
          ? (data.couponsDetails || []).map((c) => ({
              percentage: safeNum(c.percentage),
              posOrderNumber: String(c.posOrderNumber).trim(),
            }))
          : [],

      couponsGiven: DailyReportModel.cleanCouponsGiven(data.couponsGiven),
    };
  }
}
