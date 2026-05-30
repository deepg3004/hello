import { SHELL, ctaButton, escapeHtml } from "../layout";

export interface PaymentFailedData {
  buyer_name?: string | null;
  product_name?: string | null;
  amount: number;
  currency?: string;
  retry_url: string;
  reason?: string | null;
}

export function paymentFailedEmail(data: PaymentFailedData): {
  subject: string;
  html: string;
} {
  const hello = data.buyer_name ? `Hi ${data.buyer_name},` : "Hi,";
  const product = data.product_name ?? "your order";
  const amount = Number(data.amount ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
  const currency = data.currency ?? "INR";
  const reasonLine = data.reason
    ? `<p style="margin:0 0 16px;color:#71717a">Reason: <em>${escapeHtml(
        data.reason,
      )}</em></p>`
    : "";
  return {
    subject: "Payment failed — please try again",
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">Your payment didn't go through</h2>
      <p style="margin:0 0 12px">${hello}</p>
      <p style="margin:0 0 12px">
        We couldn't process your ₹${amount} ${currency} payment for
        <strong>${escapeHtml(product)}</strong>. Nothing was charged.
      </p>
      ${reasonLine}
      ${ctaButton(data.retry_url, "Try again")}
      <p style="margin:0;color:#71717a;font-size:12px">If you keep seeing this, try a different card / UPI app — we won't charge you twice.</p>
      `,
      { preheader: "We couldn't process your payment — no money taken." },
    ),
  };
}
