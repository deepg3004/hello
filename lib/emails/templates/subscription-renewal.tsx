import { APP_URL, SHELL, ctaButton, escapeHtml, kvRow } from "../layout";

export interface SubscriptionRenewalData {
  seller_name?: string | null;
  plan: string;
  renews_at: string;
  amount: number;
  currency?: string;
}

export function subscriptionRenewalEmail(data: SubscriptionRenewalData): {
  subject: string;
  html: string;
} {
  const hello = data.seller_name ? `Hi ${data.seller_name},` : "Hi,";
  const renews = new Date(data.renews_at).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const amount = Number(data.amount ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
  return {
    subject: "Your InvoxAI subscription renews in 3 days",
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">Heads up — your plan renews soon</h2>
      <p style="margin:0 0 16px">${hello}</p>
      <p style="margin:0 0 12px">Your <strong>${escapeHtml(data.plan)}</strong> subscription renews on <strong>${renews}</strong>. Nothing to do — Razorpay will auto-charge.</p>
      <table style="border-collapse:collapse;font-size:14px;margin:0 0 18px;width:100%">
        ${kvRow("Plan", escapeHtml(data.plan))}
        ${kvRow("Renews on", renews)}
        ${kvRow("Amount", `₹${amount} ${data.currency ?? "INR"}`)}
      </table>
      ${ctaButton(`${APP_URL}/dashboard/upgrade`, "Manage subscription")}
      <p style="margin:0;color:#71717a;font-size:12px">Need to change plans or cancel? Tap the button above before the renewal date.</p>
      `,
      { preheader: `Auto-charge in 3 days — ${data.plan}.` },
    ),
  };
}
