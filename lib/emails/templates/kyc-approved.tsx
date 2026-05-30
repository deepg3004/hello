import { APP_URL, SHELL, ctaButton } from "../layout";

export interface KycApprovedData {
  seller_name?: string | null;
  level: 1 | 2 | 3;
}

export function kycApprovedEmail(data: KycApprovedData): {
  subject: string;
  html: string;
} {
  const hello = data.seller_name ? `Hi ${data.seller_name},` : "Hi,";
  const summary =
    data.level === 1
      ? "Your PAN has been verified — your account is ready for sales."
      : data.level === 2
        ? "Your PAN + bank are verified — payouts are now enabled."
        : "Your Aadhaar verification is complete — high-volume payouts are live.";
  return {
    subject: `KYC Level ${data.level} approved ✅`,
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">KYC approved ✅</h2>
      <p style="margin:0 0 12px">${hello}</p>
      <p style="margin:0 0 16px">${summary}</p>
      ${ctaButton(`${APP_URL}/dashboard`, "Open dashboard")}
      `,
      { preheader: `Level ${data.level} approved — you're cleared.` },
    ),
  };
}
