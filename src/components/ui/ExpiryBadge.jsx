// src/components/ui/ExpiryBadge.jsx
import React from "react";
import { daysLeft } from "../../models/ReceiptModel.js";
import { useT } from "../../i18n/i18n.jsx";

// A colour-coded days-until-expiry pill: red if expired/≤7 days, amber ≤30.
export default function ExpiryBadge({ expiry }) {
  const { t } = useT();
  const d = daysLeft(expiry);
  if (d === null) return null;
  let cls = "bg-slate-100 text-slate-500";
  let text;
  if (d < 0) {
    cls = "bg-rose-100 text-rose-700";
    text = t("expiredAgo", { n: Math.abs(d) });
  } else if (d === 0) {
    cls = "bg-rose-100 text-rose-700";
    text = t("expiresToday");
  } else {
    text = t("daysLeft", { n: d });
    if (d <= 7) cls = "bg-rose-100 text-rose-700";
    else if (d <= 30) cls = "bg-amber-100 text-amber-700";
  }
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${cls}`}>
      {text}
    </span>
  );
}
