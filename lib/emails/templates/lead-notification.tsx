import { APP_URL, SHELL, ctaButton, escapeHtml, kvRow } from "../layout";

export interface LeadNotificationData {
  seller_name?: string | null;
  lead_name?: string | null;
  lead_email: string;
  lead_phone?: string | null;
  page_title?: string | null;
  custom_fields?: Record<string, unknown>;
}

export function leadNotificationEmail(data: LeadNotificationData): {
  subject: string;
  html: string;
} {
  const hello = data.seller_name ? `Hi ${data.seller_name},` : "Hi,";
  const customs = Object.entries(data.custom_fields ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => kvRow(k, escapeHtml(String(v))))
    .join("");
  return {
    subject: `New lead from ${data.page_title ?? "your page"}`,
    html: SHELL(
      `
      <h2 style="margin:0 0 12px;font-size:20px">New lead captured</h2>
      <p style="margin:0 0 12px">${hello}</p>
      <table style="border-collapse:collapse;font-size:14px;margin:0 0 18px;width:100%">
        ${kvRow("Name", escapeHtml(data.lead_name ?? "—"))}
        ${kvRow("Email", escapeHtml(data.lead_email))}
        ${data.lead_phone ? kvRow("Phone", escapeHtml(data.lead_phone)) : ""}
        ${data.page_title ? kvRow("Page", escapeHtml(data.page_title)) : ""}
        ${customs}
      </table>
      ${ctaButton(`${APP_URL}/dashboard/leads`, "Open in CRM")}
      `,
      { preheader: `New lead — ${data.lead_email}` },
    ),
  };
}
