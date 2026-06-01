// Shared HTML shell + tiny utilities every template uses. Pure functions —
// safe to import on the server only (escapeHtml is fine anywhere).
//
// One premium shell drives the look of EVERY transactional email: a dark
// branded header (logo or wordmark), an accent stripe, roomy typography, a
// pill CTA button, and a muted footer. Update the design here → all templates
// (receipts, KYC, payouts, recovery, lead, Telegram …) update together.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ShellOptions {
  /** Hidden inbox-preview text (Gmail/Outlook list view). */
  preheader?: string;
  /** Brand name shown in the masthead. */
  brandName?: string;
  /** Optional logo URL — renders an <img> instead of the wordmark. */
  brandLogoUrl?: string | null;
  /** Footer support address, surfaced as a mailto link. */
  supportEmail?: string;
}

// Brand accent (matches the app's purple→cyan brand gradient). Email clients
// that drop the gradient fall back to the solid first colour.
const ACCENT = "#6D28D9";
const ACCENT_GRADIENT = "linear-gradient(90deg,#6D28D9 0%,#7C3AED 45%,#06B6D4 100%)";
const HEADER_BG = "#0E0E10";

// ── Admin-set branding (platform name + logo + support email) ────────────────
// Primed once per process from platform_settings (see ./branding.ts), so every
// SHELL render picks up the live brand without threading it through each
// template. Falls back to InvoxAI defaults until primed.
interface EmailBrand {
  name: string;
  logoUrl: string | null;
  supportEmail: string;
}
let _emailBrand: EmailBrand | null = null;

export function setEmailBranding(b: {
  name?: string | null;
  logoUrl?: string | null;
  supportEmail?: string | null;
}): void {
  _emailBrand = {
    name: (b.name ?? "").trim() || "InvoxAI",
    logoUrl: (b.logoUrl ?? "").trim() || null,
    supportEmail: (b.supportEmail ?? "").trim() || "support@invoxai.io",
  };
}

export function SHELL(inner: string, opts: ShellOptions = {}): string {
  const preheader = opts.preheader ?? "";
  const brand = opts.brandName ?? _emailBrand?.name ?? "InvoxAI";
  const logoUrl = opts.brandLogoUrl ?? _emailBrand?.logoUrl ?? null;
  const support =
    opts.supportEmail ?? _emailBrand?.supportEmail ?? "support@invoxai.io";
  const masthead = logoUrl
    ? `<img src="${logoUrl}" alt="${escapeHtml(brand)}" height="28" style="display:block;height:28px;max-height:28px;width:auto;border:0;outline:none;text-decoration:none" />`
    : `<span style="font-size:18px;font-weight:700;letter-spacing:0.3px;color:#ffffff">${escapeHtml(brand)}</span>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <title>${escapeHtml(brand)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f1f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b;-webkit-font-smoothing:antialiased">
  ${preheader ? `<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f1f1f4">${escapeHtml(preheader)}</span>` : ""}
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f1f1f4">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e7ec">
          <!-- accent stripe -->
          <tr><td style="height:4px;line-height:4px;font-size:0;background:${ACCENT};background-image:${ACCENT_GRADIENT}">&nbsp;</td></tr>
          <!-- masthead -->
          <tr>
            <td style="padding:22px 32px;background:${HEADER_BG}">${masthead}</td>
          </tr>
          <!-- body -->
          <tr>
            <td style="padding:32px;font-size:15px;line-height:1.6;color:#27272a">${inner}</td>
          </tr>
          <!-- footer -->
          <tr>
            <td style="padding:22px 32px;border-top:1px solid #f0f0f3;background:#fafafa;font-size:12px;line-height:1.6;color:#8a8a94">
              <p style="margin:0 0 4px">Sent by <strong style="color:#52525b">${escapeHtml(brand)}</strong> — the all-in-one creator commerce platform.</p>
              <p style="margin:0">Need help? Email <a href="mailto:${escapeHtml(support)}" style="color:${ACCENT};text-decoration:none">${escapeHtml(support)}</a>.</p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#b4b4be">© ${escapeHtml(brand)}. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function ctaButton(href: string, label: string, color = ACCENT): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 14px;border-collapse:separate">
    <tr><td style="border-radius:10px;background:${color}">
      <a href="${href}" style="display:inline-block;padding:13px 26px;border-radius:10px;background:${color};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.2px">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

export function kvRow(label: string, value: string): string {
  return `<tr><td style="padding:7px 16px 7px 0;color:#8a8a94;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:7px 0;color:#27272a;text-align:right">${value}</td></tr>`;
}

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
