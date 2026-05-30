import { APP_URL, SHELL, ctaButton, escapeHtml } from "../layout";

export interface WelcomeData {
  seller_name?: string | null;
}

export function welcomeEmail(data: WelcomeData): {
  subject: string;
  html: string;
} {
  const hello = data.seller_name ? `Hi ${data.seller_name},` : "Hi,";
  return {
    subject: "Welcome to InvoxAI!",
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">Welcome to InvoxAI 👋</h2>
      <p style="margin:0 0 16px">${hello}</p>
      <p style="margin:0 0 12px">Great to have you here. In under 60 seconds you can:</p>
      <ol style="margin:0 0 16px 18px;padding:0;line-height:1.65;color:#27272a">
        <li>Add a name, phone, and avatar to your <strong>profile</strong>.</li>
        <li>Pick a <strong>template</strong> and publish your first page.</li>
        <li>Connect your <strong>bank</strong> so payouts can land in your account.</li>
      </ol>
      ${ctaButton(`${APP_URL}/dashboard/onboarding`, "Open your checklist")}
      <p style="margin:0;color:#71717a;font-size:12px">Need help? Just reply — a real human reads every email at ${escapeHtml(
        process.env.RESEND_REPLY_TO ?? "support@invoxai.io",
      )}.</p>
      `,
      { preheader: "Start collecting payments in under 60 seconds." },
    ),
  };
}
