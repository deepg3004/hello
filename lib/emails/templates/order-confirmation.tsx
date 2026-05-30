// Buyer email after a paid order. Includes the GST-invoice link + the
// Telegram join link when the page sold VIP access.

import { APP_URL, SHELL, ctaButton, escapeHtml, kvRow } from "../layout";

export interface OrderConfirmationData {
  buyer_name?: string | null;
  seller_name?: string | null;
  product_name?: string | null;
  amount: number;
  currency?: string;
  order_id: string;
  /** Public invoice link or signed URL. */
  invoice_url?: string | null;
  /** Telegram one-time invite when sold VIP access. */
  telegram_invite_url?: string | null;
}

export function orderConfirmationEmail(data: OrderConfirmationData): {
  subject: string;
  html: string;
} {
  const hello = data.buyer_name ? `Hi ${data.buyer_name},` : "Hi,";
  const product = data.product_name ?? "Your purchase";
  const seller = data.seller_name ?? "the seller";
  const amount = Number(data.amount ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
  const currency = data.currency ?? "INR";
  const orderShort = data.order_id.slice(0, 12) + "…";

  const tgBlock = data.telegram_invite_url
    ? `<p style="margin:0 0 12px"><strong>Join the VIP group:</strong></p>${ctaButton(
        data.telegram_invite_url,
        "Open in Telegram",
        "#0088cc",
      )}<p style="margin:0 0 12px;color:#71717a;font-size:12px">Invite is for you only and expires in 10 minutes.</p>`
    : "";

  const invoiceBlock = data.invoice_url
    ? `${ctaButton(data.invoice_url, "Download GST invoice")}<p style="margin:0 0 12px;color:#71717a;font-size:12px">Link is valid for 7 days. You can always re-download from your order page.</p>`
    : "";

  return {
    subject: `Your order is confirmed! 🎉 — ${product}`,
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">Your order is confirmed! 🎉</h2>
      <p style="margin:0 0 12px">${hello}</p>
      <p style="margin:0 0 16px">
        Your payment for <strong>${escapeHtml(product)}</strong> from
        ${escapeHtml(seller)} was successful.
      </p>
      <table style="border-collapse:collapse;font-size:14px;margin:0 0 18px;width:100%">
        ${kvRow("Item", escapeHtml(product))}
        ${kvRow("Amount", `₹${amount} ${currency}`)}
        ${kvRow("Order id", `<span style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px">${orderShort}</span>`)}
      </table>
      ${invoiceBlock}
      ${tgBlock}
      <p style="margin:0 0 12px"><a href="${APP_URL}/order/${data.order_id}" style="color:#0a0a0a">View order details →</a></p>
      `,
      { preheader: `Receipt for ${product}` },
    ),
  };
}
