import { SHELL, ctaButton, escapeHtml } from "../layout";
import type { RecoveryHero } from "./abandoned-recovery-1";

export interface AbandonedRecovery2Data extends RecoveryHero {
  coupon_code?: string | null;
  /** "10% off", "₹500 off", etc. */
  coupon_label?: string | null;
}

export function abandonedRecovery2Email(args: AbandonedRecovery2Data): {
  subject: string;
  html: string;
} {
  const hello = args.buyer_name ? `Hi ${args.buyer_name},` : "Hi,";
  const subject = args.coupon_code
    ? `${args.coupon_label ?? "A little something off"} — ${args.product_name ?? "your cart"}`
    : "Still thinking it over?";

  const couponBlock = args.coupon_code
    ? `<div style="margin:0 0 18px;border:1px dashed #e4e4e7;border-radius:8px;padding:14px 16px;background:#fafafa">
        <p style="margin:0 0 4px;color:#18181b;font-size:14px">
          Here's <strong>${escapeHtml(args.coupon_label ?? "a discount")}</strong> to complete your order.
        </p>
        <p style="margin:0;font-size:18px;font-weight:700;font-family:ui-monospace,Menlo,Consolas,monospace;color:#18181b;letter-spacing:1.5px">${escapeHtml(args.coupon_code)}</p>
        <p style="margin:6px 0 0;color:#71717a;font-size:11px">Apply it at checkout — valid while stocks last.</p>
      </div>`
    : "";

  return {
    subject,
    html: SHELL(
      `
      <p style="margin:0 0 12px;color:#a1a1aa;font-size:11px;text-transform:uppercase;letter-spacing:1.4px">${
        args.coupon_code ? "One-day only" : "Last chance"
      }</p>
      <p style="margin:0 0 12px">${hello}</p>
      <p style="margin:0 0 16px">
        Just checking in — you started checking out <strong>${escapeHtml(args.product_name ?? "your cart")}</strong>
        yesterday on ${escapeHtml(args.seller_name ?? "the seller")}'s page but didn't finish.
      </p>
      ${couponBlock}
      ${ctaButton(args.recovery_url, args.coupon_code ? `Use ${args.coupon_code} now →` : "Complete your purchase →")}
      `,
      { preheader: "Your cart is still waiting." },
    ),
  };
}
