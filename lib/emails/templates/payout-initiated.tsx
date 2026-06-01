import { APP_URL, SHELL, ctaButton, escapeHtml, kvRow } from "../layout";

export interface PayoutInitiatedData {
  seller_name?: string | null;
  amount: number;
  currency?: string;
  bank_last4?: string | null;
}

export function payoutInitiatedEmail(data: PayoutInitiatedData): {
  subject: string;
  html: string;
} {
  const hello = data.seller_name ? `Hi ${data.seller_name},` : "Hi,";
  const amount = Number(data.amount ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
  return {
    subject: `Payout initiated — ₹${amount}`,
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">Payout on the way 🚀</h2>
      <p style="margin:0 0 12px">${hello}</p>
      <p style="margin:0 0 16px">Your payout of <strong>₹${amount} ${data.currency ?? "INR"}</strong> has been initiated${
        data.bank_last4 ? ` to your bank account ending ${escapeHtml(data.bank_last4)}` : ""
      }. It typically lands within 2–4 hours.</p>
      <table style="border-collapse:collapse;font-size:14px;margin:0 0 18px;width:100%">
        ${kvRow("Amount", `₹${amount} ${data.currency ?? "INR"}`)}
        ${data.bank_last4 ? kvRow("To bank ending", escapeHtml(data.bank_last4)) : ""}
        ${kvRow("Status", "Initiated")}
      </table>
      ${ctaButton(`${APP_URL}/dashboard/payouts`, "View payouts")}
      `,
      { preheader: `₹${amount} is on its way to your bank.` },
    ),
  };
}
