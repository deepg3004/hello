import { APP_URL, SHELL, ctaButton } from "../layout";

export interface KycReceivedData {
  seller_name?: string | null;
  /** When true, the submission needs manual review (flagged). */
  manual?: boolean;
}

export function kycReceivedEmail(data: KycReceivedData): {
  subject: string;
  html: string;
} {
  const hello = data.seller_name ? `Hi ${data.seller_name},` : "Hi,";
  const summary = data.manual
    ? "We've received your KYC details and our team will verify them by hand. This usually takes 1–2 business days."
    : "We've received your KYC details and they're being verified. We'll email you the moment it's approved.";
  return {
    subject: "We've received your KYC ✅",
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">KYC submitted ✅</h2>
      <p style="margin:0 0 12px">${hello}</p>
      <p style="margin:0 0 16px">${summary}</p>
      ${ctaButton(`${APP_URL}/dashboard/kyc`, "View KYC status")}
      `,
      { preheader: "Your KYC submission was received." },
    ),
  };
}
