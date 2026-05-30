import { APP_URL, SHELL, ctaButton, escapeHtml } from "../layout";

export interface KycRejectedData {
  seller_name?: string | null;
  level: 1 | 2 | 3;
  reason?: string | null;
}

export function kycRejectedEmail(data: KycRejectedData): {
  subject: string;
  html: string;
} {
  const hello = data.seller_name ? `Hi ${data.seller_name},` : "Hi,";
  return {
    subject: `KYC Level ${data.level} needs your attention`,
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">We couldn't verify your KYC</h2>
      <p style="margin:0 0 12px">${hello}</p>
      <p style="margin:0 0 16px">Your Level ${data.level} verification didn't pass. ${
        data.reason
          ? `Reason from our partner: <em>${escapeHtml(data.reason)}</em>.`
          : "Common reasons are mismatched names or unclear document scans."
      }</p>
      <p style="margin:0 0 16px">Tap below to re-submit — it usually takes under 2 minutes.</p>
      ${ctaButton(`${APP_URL}/dashboard/kyc`, "Re-submit KYC")}
      `,
      { preheader: "Re-submit your KYC — under 2 minutes." },
    ),
  };
}
