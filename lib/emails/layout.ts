// Shared HTML shell + tiny utilities every template uses. Pure functions —
// safe to import on the server only (escapeHtml is fine anywhere).

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ShellOptions {
  preheader?: string;
  /** Brand name used in the masthead. */
  brandName?: string;
}

export function SHELL(inner: string, opts: ShellOptions = {}): string {
  const preheader = opts.preheader ?? "";
  const brand = opts.brandName ?? "InvoxAI";
  // The preheader span uses inline CSS that hides it from the rendered email
  // body but lets it leak into the Gmail / Outlook list-view preview.
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(brand)}</title>
</head>
<body style="margin:0;padding:24px 0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18181b">
  ${preheader ? `<span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;font-size:1px;color:#f4f4f5">${escapeHtml(preheader)}</span>` : ""}
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;border-collapse:collapse;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden">
          <tr>
            <td style="padding:18px 22px;border-bottom:1px solid #f4f4f5;font-size:14px;font-weight:700;letter-spacing:0.4px;color:#18181b">${escapeHtml(brand)}</td>
          </tr>
          <tr>
            <td style="padding:22px;font-size:14px;line-height:1.55;color:#27272a">${inner}</td>
          </tr>
          <tr>
            <td style="padding:14px 22px;border-top:1px solid #f4f4f5;font-size:11px;color:#71717a;background:#fafafa">
              Sent by ${escapeHtml(brand)} · A SaaS for creators &amp; sellers
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function ctaButton(href: string, label: string, color = "#0a0a0a"): string {
  return `<p style="margin:0 0 12px"><a href="${href}" style="display:inline-block;background:${color};color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(label)}</a></p>`;
}

export function kvRow(label: string, value: string): string {
  return `<tr><td style="padding:6px 12px 6px 0;color:#71717a">${escapeHtml(label)}</td><td style="padding:6px 0">${value}</td></tr>`;
}

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
