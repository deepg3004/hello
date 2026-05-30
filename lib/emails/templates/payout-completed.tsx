import { APP_URL, SHELL, ctaButton, escapeHtml, kvRow } from "../layout";

export interface PayoutCompletedData {
  seller_name?: string | null;
  amount: number;
  currency?: string;
  bank_last4?: string | null;
  utr?: string | null;
  payout_id?: string | null;
}

export function payoutCompletedEmail(data: PayoutCompletedData): {
  subject: string;
  html: string;
} {
  const hello = data.seller_name ? `Hi ${data.seller_name},` : "Hi,";
  const amount = Number(data.amount ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
  return {
    subject: `Payout settled — ₹${amount} ✅`,
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">Payout settled ✅</h2>
      <p style="margin:0 0 12px">${hello}</p>
      <p style="margin:0 0 16px">₹${amount} ${data.currency ?? "INR"} has been credited to your bank account${
        data.bank_last4 ? ` ending ${escapeHtml(data.bank_last4)}` : ""
      }.</p>
      <table style="border-collapse:collapse;font-size:14px;margin:0 0 18px;width:100%">
        ${kvRow("Amount", `₹${amount} ${data.currency ?? "INR"}`)}
        ${data.bank_last4 ? kvRow("To bank ending", escapeHtml(data.bank_last4)) : ""}
        ${data.utr ? kvRow("UTR", `<code>${escapeHtml(data.utr)}</code>`) : ""}
        ${data.payout_id ? kvRow("Payout id", `<code>${escapeHtml(data.payout_id)}</code>`) : ""}
      </table>
      ${ctaButton(`${APP_URL}/dashboard/payouts`, "View payouts")}
      `,
      { preheader: `₹${amount} landed in your bank.` },
    ),
  };
}
