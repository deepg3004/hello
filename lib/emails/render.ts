// Keyed email renderer with a DB override layer (the CMS).
//
// renderEmail(key, data) checks the admin-editable `email_templates` table
// first; if an enabled override exists it substitutes {{placeholders}} from
// `data` (+ globals) and wraps in the branded SHELL (unless the row turns the
// shell off). Otherwise it falls back to the built-in code template, so dynamic
// logic/conditionals are preserved until an admin chooses to override.
//
// Server-only (reads the admin client). Pre-migration / on any DB error it
// degrades to the code templates so sends never break.

import { createAdminClient } from "@/lib/supabase/admin";

import { SHELL, escapeHtml, APP_URL } from "./layout";
import { primeEmailBranding } from "./branding";

// Built-in template renderers (facade + the live legacy ones).
import { welcomeEmail } from "./templates/welcome";
import { orderConfirmationEmail } from "./templates/order-confirmation";
import { paymentFailedEmail } from "./templates/payment-failed";
import { subscriptionRenewalEmail } from "./templates/subscription-renewal";
import { leadNotificationEmail } from "./templates/lead-notification";
import { abandonedRecovery1Email } from "./templates/abandoned-recovery-1";
import { abandonedRecovery2Email } from "./templates/abandoned-recovery-2";
import {
  saleConfirmationEmail,
  inviteEmail,
  expiryEmail,
  reminderEmail,
  confirmationEmail,
  leadMagnetDeliveryEmail,
  newLeadNotificationEmail,
  recoveryEmail1,
  recoveryEmail2,
} from "@/lib/email";

export interface Rendered {
  subject: string;
  html: string;
}

type Renderer = (data: Record<string, unknown>) => Rendered;

// Every send key → its built-in renderer. The fns are loosely typed here; call
// sites pass the matching data shape.
export const CODE_TEMPLATES: Record<string, Renderer> = {
  // Facade
  welcome: (d) => welcomeEmail(d as never),
  order_confirmation: (d) => orderConfirmationEmail(d as never),
  payment_failed: (d) => paymentFailedEmail(d as never),
  subscription_renewal: (d) => subscriptionRenewalEmail(d as never),
  lead_notification: (d) => leadNotificationEmail(d as never),
  abandoned_recovery_1: (d) => abandonedRecovery1Email(d as never),
  abandoned_recovery_2: (d) => abandonedRecovery2Email(d as never),
  // Legacy (lib/email.ts)
  sale_receipt: (d) => saleConfirmationEmail(d as never),
  telegram_invite: (d) => inviteEmail(d as never),
  telegram_expiry: (d) => expiryEmail(d as never),
  telegram_reminder: (d) => reminderEmail(d as never),
  lead_confirmation: (d) => confirmationEmail(d as never),
  lead_magnet: (d) => leadMagnetDeliveryEmail(d as never),
  lead_alert: (d) => newLeadNotificationEmail(d as never),
  recovery_1: (d) => recoveryEmail1(d as never),
  recovery_2: (d) => recoveryEmail2(d as never),
};

// Placeholders available per key (the data fields each template understands).
export const GLOBAL_PLACEHOLDERS = ["brand_name", "app_url", "support_email", "year"];

export const PLACEHOLDERS: Record<string, string[]> = {
  welcome: ["seller_name"],
  order_confirmation: ["buyer_name", "seller_name", "product_name", "amount", "currency", "order_id", "invoice_url", "telegram_invite_url"],
  payment_failed: ["buyer_name", "product_name", "amount", "currency", "retry_url", "reason"],
  subscription_renewal: ["seller_name", "plan", "renews_at", "amount", "currency"],
  lead_notification: ["seller_name", "lead_name", "lead_email", "lead_phone", "page_title"],
  abandoned_recovery_1: ["buyer_name", "seller_name", "product_name", "product_price", "recovery_url"],
  abandoned_recovery_2: ["buyer_name", "seller_name", "product_name", "product_price", "recovery_url", "coupon_code", "coupon_label"],
  sale_receipt: ["buyerName", "sellerLegalName", "productName", "amountInr", "currency", "orderId", "invoiceUrl", "orderUrl"],
  telegram_invite: ["buyerName", "groupName", "inviteLink"],
  telegram_expiry: ["buyerName", "groupName", "renewUrl"],
  telegram_reminder: ["buyerName", "groupName", "daysLeft", "renewUrl"],
  lead_confirmation: ["leadName", "pageTitle", "body"],
  lead_magnet: ["leadName", "pageTitle", "downloadUrl", "expiresLabel"],
  lead_alert: ["sellerName", "leadName", "leadEmail", "leadPhone", "pageTitle"],
  recovery_1: ["buyerName", "sellerName", "productName", "productPrice", "recoveryUrl"],
  recovery_2: ["buyerName", "sellerName", "productName", "productPrice", "recoveryUrl", "couponCode", "couponLabel"],
};

// Representative sample data per key — used by the admin live-preview + test
// sends so the {{placeholders}} resolve to realistic values.
export const SAMPLE_DATA: Record<string, Record<string, unknown>> = {
  welcome: { seller_name: "Ravi Kumar" },
  order_confirmation: { buyer_name: "Asha Patel", seller_name: "Acme Studio", product_name: "Pro Trading Course", amount: 1499, currency: "INR", order_id: "ord_abcdef123456", invoice_url: `${APP_URL}/api/orders/x/invoice` },
  payment_failed: { buyer_name: "Asha Patel", product_name: "Pro Trading Course", amount: 1499, currency: "INR", retry_url: `${APP_URL}/p/course/checkout`, reason: "Card declined" },
  subscription_renewal: { seller_name: "Ravi Kumar", plan: "Pro", renews_at: "2026-07-01", amount: 999, currency: "INR" },
  lead_notification: { seller_name: "Ravi Kumar", lead_name: "Asha Patel", lead_email: "asha@example.com", lead_phone: "+91 98765 43210", page_title: "Free Trading Guide" },
  abandoned_recovery_1: { buyer_name: "Asha Patel", seller_name: "Acme Studio", product_name: "Pro Trading Course", product_price: 1499, recovery_url: `${APP_URL}/p/course/checkout?r=x` },
  abandoned_recovery_2: { buyer_name: "Asha Patel", seller_name: "Acme Studio", product_name: "Pro Trading Course", product_price: 1499, recovery_url: `${APP_URL}/p/course/checkout?r=x`, coupon_code: "SAVE10", coupon_label: "10% off" },
  sale_receipt: { buyerName: "Asha Patel", sellerLegalName: "Acme Studio", productName: "Pro Trading Course", amountInr: 1499, currency: "INR", orderId: "ord_abcdef123456", invoiceUrl: `${APP_URL}/api/orders/x/invoice`, orderUrl: `${APP_URL}/order/x` },
  telegram_invite: { buyerName: "Asha Patel", groupName: "VIP Signals", inviteLink: "https://t.me/+abc123xyz" },
  telegram_expiry: { buyerName: "Asha Patel", groupName: "VIP Signals", renewUrl: `${APP_URL}/p/vip` },
  telegram_reminder: { buyerName: "Asha Patel", groupName: "VIP Signals", daysLeft: 3, renewUrl: `${APP_URL}/p/vip` },
  lead_confirmation: { leadName: "Asha Patel", pageTitle: "Free Trading Guide", body: "Thanks for signing up! Your guide is on the way." },
  lead_magnet: { leadName: "Asha Patel", pageTitle: "Free Trading Guide", downloadUrl: `${APP_URL}/download/x`, expiresLabel: "Link expires in 7 days." },
  lead_alert: { sellerName: "Ravi Kumar", leadName: "Asha Patel", leadEmail: "asha@example.com", leadPhone: "+91 98765 43210", pageTitle: "Free Trading Guide" },
  recovery_1: { buyerName: "Asha Patel", sellerName: "Acme Studio", productName: "Pro Trading Course", productPrice: 1499, recoveryUrl: `${APP_URL}/p/course/checkout?r=x` },
  recovery_2: { buyerName: "Asha Patel", sellerName: "Acme Studio", productName: "Pro Trading Course", productPrice: 1499, recoveryUrl: `${APP_URL}/p/course/checkout?r=x`, couponCode: "SAVE10", couponLabel: "10% off" },
};

// Canonical editable built-in templates (by send key) → display metadata.
// `live` = wired to a real event today; non-live "alt" templates exist but
// aren't triggered (editing them has no effect until wired).
export interface BuiltinMeta {
  key: string;
  name: string;
  audience: "Seller" | "KYC" | "Billing" | "Buyer";
  role: string;
  live: boolean;
}

export const BUILTIN_META: BuiltinMeta[] = [
  { key: "welcome", name: "Welcome (new signup)", audience: "Seller", role: "onboarding", live: true },
  { key: "lead_alert", name: "New lead alert (seller)", audience: "Seller", role: "seller", live: true },
  { key: "subscription_renewal", name: "Subscription renewal", audience: "Seller", role: "billing", live: false },
  { key: "sale_receipt", name: "Order receipt (buyer)", audience: "Billing", role: "billing", live: true },
  { key: "payment_failed", name: "Payment failed (buyer)", audience: "Billing", role: "billing", live: false },
  { key: "order_confirmation", name: "Order confirmation (alt)", audience: "Billing", role: "billing", live: false },
  { key: "telegram_invite", name: "Telegram invite", audience: "Buyer", role: "buyer", live: true },
  { key: "telegram_reminder", name: "Telegram renewal reminder", audience: "Buyer", role: "buyer", live: true },
  { key: "telegram_expiry", name: "Telegram access expired", audience: "Buyer", role: "buyer", live: true },
  { key: "lead_confirmation", name: "Lead confirmation", audience: "Buyer", role: "buyer", live: true },
  { key: "lead_magnet", name: "Lead magnet delivery", audience: "Buyer", role: "buyer", live: true },
  { key: "recovery_1", name: "Cart recovery #1", audience: "Buyer", role: "buyer", live: true },
  { key: "recovery_2", name: "Cart recovery #2 (coupon)", audience: "Buyer", role: "buyer", live: true },
];

// ---------------------------------------------------------------------------
// Placeholder substitution
// ---------------------------------------------------------------------------

function flatten(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    if (v === null || v === undefined) {
      out[k] = "";
    } else if (typeof v === "object") {
      // e.g. custom_fields — render as "k: v" lines.
      out[k] = Object.entries(v as Record<string, unknown>)
        .map(([kk, vv]) => `${kk}: ${String(vv)}`)
        .join(", ");
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

/** Replace {{ field }} from data + globals. Unknown placeholders → "". HTML in
 *  values is escaped (placeholders carry data, not markup). */
export function substitute(
  template: string,
  data: Record<string, unknown>,
): string {
  const map = flatten(data);
  const globals: Record<string, string> = {
    brand_name: "InvoxAI",
    app_url: APP_URL,
    support_email: "support@invoxai.io",
    year: "2026",
  };
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const raw = map[key] ?? globals[key] ?? "";
    return escapeHtml(raw);
  });
}

// ---------------------------------------------------------------------------
// Override lookup (cached)
// ---------------------------------------------------------------------------

export interface TemplateRow {
  key: string;
  subject: string;
  body_html: string;
  use_shell: boolean;
  enabled: boolean;
}

const CACHE_TTL_MS = 30_000;
let cache: { rows: Map<string, TemplateRow>; expires_at: number } | null = null;

async function getOverrides(): Promise<Map<string, TemplateRow>> {
  if (cache && cache.expires_at > Date.now()) return cache.rows;
  const rows = new Map<string, TemplateRow>();
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("email_templates")
      .select("key, subject, body_html, use_shell, enabled")
      .eq("enabled", true);
    for (const r of (data ?? []) as TemplateRow[]) rows.set(r.key, r);
  } catch {
    // Table missing / DB error — no overrides, use code templates.
  }
  cache = { rows, expires_at: Date.now() + CACHE_TTL_MS };
  return rows;
}

/** Drop the override cache (call after an admin save). */
export function invalidateTemplateCache(): void {
  cache = null;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export async function renderEmail(
  key: string,
  data: Record<string, unknown> = {},
): Promise<Rendered> {
  const overrides = await getOverrides();
  const row = overrides.get(key);
  if (row && row.subject) {
    await primeEmailBranding();
    const subject = substitute(row.subject, data);
    const inner = substitute(row.body_html, data);
    return { subject, html: row.use_shell ? SHELL(inner) : inner };
  }
  const code = CODE_TEMPLATES[key];
  if (code) return code(data);
  throw new Error(`Unknown email template: ${key}`);
}

/** Render directly from raw override fields (used by the admin live-preview). */
export async function renderFromFields(
  fields: { subject: string; body_html: string; use_shell: boolean },
  data: Record<string, unknown>,
): Promise<Rendered> {
  await primeEmailBranding();
  const subject = substitute(fields.subject, data);
  const inner = substitute(fields.body_html, data);
  return { subject, html: fields.use_shell ? SHELL(inner) : inner };
}
