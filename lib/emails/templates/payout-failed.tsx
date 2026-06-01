import { APP_URL, SHELL, ctaButton, escapeHtml, kvRow } from "../layout";

export interface PayoutFailedData {
  seller_name?: string | null;
  amount: number;
  currency?: string;
  /** Why it failed / was rejected. */
  reason?: string | null;
}

export function payoutFailedEmail(data: PayoutFailedData): {
  subject: string;
  html: string;
} {
  const hello = data.seller_name ? `Hi ${data.seller_name},` : "Hi,";
  const amount = Number(data.amount ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
  return {
    subject: `Payout unsuccessful — ₹${amount} returned`,
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">Payout didn't go through</h2>
      <p style="margin:0 0 12px">${hello}</p>
      <p style="margin:0 0 16px">Your payout of <strong>₹${amount} ${data.currency ?? "INR"}</strong> couldn't be completed and the amount has been returned to your available balance. You can request it again anytime.</p>
      <table style="border-collapse:collapse;font-size:14px;margin:0 0 18px;width:100%">
        ${kvRow("Amount", `₹${amount} ${data.currency ?? "INR"}`)}
        ${data.reason ? kvRow("Reason", escapeHtml(data.reason)) : ""}
      </table>
      ${ctaButton(`${APP_URL}/dashboard/payouts`, "Request again")}
      <p style="margin:14px 0 0;color:#71717a;font-size:12px">If this keeps happening, double-check your bank details under Settings → Payouts, or contact support.</p>
      `,
      { preheader: `Your ₹${amount} payout was returned to your balance.` },
    ),
  };
}
