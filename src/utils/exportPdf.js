// src/utils/exportPdf.js
// Printable order sheet -> PDF.
//
// Deliberately NO pdf library. We build a small self-contained HTML document
// and hand it to the browser's print dialog, where every platform offers
// "Save as PDF" (iOS/Android share sheet included). That keeps the PWA bundle
// small and gives the user native control over paper size and margins.
//
// The sheet groups items by ORDER TYPE — one section per type, each with its
// own item count — because that is how the owner actually places the orders.
import { orderRef, selectOrderRows } from "./exportCsv.js";
import { num as orderNum, orderUnitOf } from "../models/OrderModel.js";

// Business letterhead printed at the top of every order sheet.
const BUSINESS = {
  name: "Misa Hindusa Poznan",
  address: "Szamarzewskiego 14, 60-516 Poznań",
  nip: "NIP 9241799529",
};

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Group the selected rows into [{ orderType, rows }] preserving sort order.
function groupByOrderType(rows) {
  const groups = [];
  let current = null;
  for (const r of rows) {
    if (!current || current.orderType !== r.orderType) {
      current = { orderType: r.orderType, rows: [] };
      groups.push(current);
    }
    current.rows.push(r);
  }
  return groups;
}

// Build the full print document. Exported separately from the download so it
// can be unit-tested without a browser.
export function buildOrderPrintHtml(order, items, lines, selected = null) {
  const ref = orderRef(order);
  const status = order?.status || "draft";
  const groups = groupByOrderType(selectOrderRows(items, lines, selected));
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const printed = new Date().toLocaleString();

  const sections = groups
    .map(
      (g) => `
    <section>
      <h2>${esc(g.orderType)} <span class="count">${g.rows.length}</span></h2>
      <table>
        <thead>
          <tr><th class="w-item">Item</th><th class="w-qty">Qty</th><th class="w-unit">Unit</th><th>Note</th><th class="w-tick">✓</th></tr>
        </thead>
        <tbody>
          ${g.rows
            .map(
              ({ item, line }) => `
          <tr>
            <td>${esc(item.name)}</td>
            <td class="num">${esc(orderNum(line.qty))}</td>
            <td>${esc(orderUnitOf(item))}</td>
            <td>${esc(line.note || "")}</td>
            <td class="tick"></td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </section>`,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ref)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
         color: #0f172a; margin: 0; padding: 16px; font-size: 12px; }
  header { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 14px; }
  .brand { font-size: 17px; font-weight: 800; letter-spacing: .01em; }
  .brand-sub { color: #475569; font-size: 11px; margin-top: 1px; }
  .rule { border-top: 1px solid #e2e8f0; margin: 7px 0 6px; }
  h1 { font-size: 14px; margin: 0 0 2px; font-weight: 700; }
  .meta { color: #475569; font-size: 11px; }
  section { margin-bottom: 16px; page-break-inside: auto; }
  h2 { font-size: 13px; margin: 0 0 6px; padding: 4px 8px; background: #f1f5f9;
       border-left: 3px solid #0d9488; text-transform: uppercase; letter-spacing: .04em; }
  h2 .count { float: right; color: #64748b; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #64748b;
       border-bottom: 1px solid #94a3b8; }
  .num { font-weight: 700; text-align: right; }
  .w-item { width: 46%; } .w-qty { width: 10%; } .w-unit { width: 12%; } .w-tick { width: 8%; }
  .tick { border: 1px solid #cbd5e1; height: 14px; }
  /* Keep a group's heading with at least the start of its table. */
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .empty { color: #64748b; padding: 24px 0; text-align: center; }
  @media print { body { padding: 0; } .noprint { display: none; } }
</style>
</head>
<body>
<header>
  <div class="brand">${esc(BUSINESS.name)}</div>
  <div class="brand-sub">${esc(BUSINESS.address)} · ${esc(BUSINESS.nip)}</div>
  <div class="rule"></div>
  <h1>Order ${esc(ref)}</h1>
  <div class="meta">${esc(status)} · ${total} item${total === 1 ? "" : "s"} · printed ${esc(printed)}</div>
</header>
${sections || '<p class="empty">No items match the selected order types.</p>'}
</body>
</html>`;
}

// Open the print sheet and trigger the browser's print dialog ("Save as PDF").
// Uses a hidden same-origin iframe rather than window.open: popup blockers and
// iOS standalone PWAs routinely swallow new windows, and the iframe prints
// without ever navigating the user away from the app.
export async function downloadOrderPdf(order, items, lines, selected = null) {
  const html = buildOrderPrintHtml(order, items, lines, selected);

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);

  const cleanup = () => {
    // Delay removal: Safari tears down the print job if the frame goes early.
    setTimeout(() => frame.remove(), 1000);
  };

  frame.onload = () => {
    try {
      const win = frame.contentWindow;
      win.focus();
      win.onafterprint = cleanup;
      win.print();
      // onafterprint is unreliable on iOS — fall back to a timed cleanup.
      setTimeout(cleanup, 60000);
    } catch {
      cleanup();
    }
  };

  const doc = frame.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
}
