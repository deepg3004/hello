// Catalog of every transactional email template, rendered with representative
// sample data — powers the Admin → Email → Templates preview gallery so admins
// can see exactly what each email looks like. Server-only (pulls in the
// template renderers). Branding is primed by the page before calling render().

import { APP_URL } from "./layout";

// Facade templates (lib/emails/templates/*)
import { welcomeEmail } from "./templates/welcome";
import { orderConfirmationEmail } from "./templates/order-confirmation";
import { paymentFailedEmail } from "./templates/payment-failed";
import { subscriptionRenewalEmail } from "./templates/subscription-renewal";
import { leadNotificationEmail } from "./templates/lead-notification";
import { abandonedRecovery1Email } from "./templates/abandoned-recovery-1";

// Legacy templates that are actively sending (lib/email.ts)
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

export type Audience = "Buyer" | "Seller" | "KYC" | "Billing";

export interface CatalogEntry {
  key: string;
  label: string;
  audience: Audience;
  /** True when this template is wired to a real event today. */
  live: boolean;
  description: string;
  render: () => { subject: string; html: string };
}

const IMG = "https://gbqmeeduqttxsqghnvna.supabase.co/storage/v1/object/public/learn-media/image/eT76PNywPl0J.gif";

export const EMAIL_CATALOG: CatalogEntry[] = [
  // ── Seller / onboarding ────────────────────────────────────────────────
  {
    key: "welcome",
    label: "Welcome (new signup)",
    audience: "Seller",
    live: true,
    description: "Sent right after a new seller creates their account.",
    render: () => welcomeEmail({ seller_name: "Ravi Kumar" }),
  },
  {
    key: "lead_notification",
    label: "New lead alert (seller)",
    audience: "Seller",
    live: true,
    description: "Sent to the seller when a lead is captured on their page.",
    render: () =>
      newLeadNotificationEmail({
        sellerName: "Ravi Kumar",
        leadName: "Asha Patel",
        leadEmail: "asha@example.com",
        leadPhone: "+91 98765 43210",
        pageTitle: "Free Trading Guide",
        customFields: { City: "Mumbai", Budget: "₹50,000" },
        crmUrl: `${APP_URL}/dashboard/leads`,
      }),
  },
  {
    key: "subscription_renewal",
    label: "Subscription renewal",
    audience: "Seller",
    live: false,
    description: "Plan renewal notice (template available; not yet wired).",
    render: () =>
      subscriptionRenewalEmail({
        seller_name: "Ravi Kumar",
        plan: "Pro",
        renews_at: "2026-07-01",
        amount: 999,
      }),
  },

  // ── Billing / payouts ──────────────────────────────────────────────────
  {
    key: "sale_receipt",
    label: "Order receipt (buyer)",
    audience: "Billing",
    live: true,
    description: "GST receipt sent to the buyer after a successful payment.",
    render: () =>
      saleConfirmationEmail({
        buyerName: "Asha Patel",
        sellerLegalName: "Acme Studio",
        productName: "Pro Trading Course",
        amountInr: 1499,
        orderId: "ord_abcdef123456",
        invoiceUrl: `${APP_URL}/api/orders/x/invoice`,
        orderUrl: `${APP_URL}/order/x`,
      }),
  },
  {
    key: "payment_failed",
    label: "Payment failed (buyer)",
    audience: "Billing",
    live: false,
    description: "Buyer-facing retry prompt (template available).",
    render: () =>
      paymentFailedEmail({
        buyer_name: "Asha Patel",
        product_name: "Pro Trading Course",
        amount: 1499,
        retry_url: `${APP_URL}/p/course/checkout`,
        reason: "Card declined",
      }),
  },
  {
    key: "order_confirmation",
    label: "Order confirmation (alt)",
    audience: "Billing",
    live: false,
    description: "Alternative receipt template (the legacy receipt is live).",
    render: () =>
      orderConfirmationEmail({
        buyer_name: "Asha Patel",
        seller_name: "Acme Studio",
        product_name: "Pro Trading Course",
        amount: 1499,
        order_id: "ord_abcdef123456",
        invoice_url: `${APP_URL}/api/orders/x/invoice`,
      }),
  },

  // ── Buyer: Telegram + lead delivery + recovery ─────────────────────────
  {
    key: "telegram_invite",
    label: "Telegram invite",
    audience: "Buyer",
    live: true,
    description: "Private join link after a buyer purchases VIP access.",
    render: () =>
      inviteEmail({
        buyerName: "Asha Patel",
        groupName: "VIP Signals",
        inviteLink: "https://t.me/+abc123xyz",
      }),
  },
  {
    key: "telegram_reminder",
    label: "Telegram renewal reminder",
    audience: "Buyer",
    live: true,
    description: "Reminder before a buyer's VIP access expires.",
    render: () =>
      reminderEmail({
        buyerName: "Asha Patel",
        groupName: "VIP Signals",
        daysLeft: 3,
        renewUrl: `${APP_URL}/p/vip`,
      }),
  },
  {
    key: "telegram_expiry",
    label: "Telegram access expired",
    audience: "Buyer",
    live: true,
    description: "Sent when VIP access runs out and the buyer is removed.",
    render: () =>
      expiryEmail({
        buyerName: "Asha Patel",
        groupName: "VIP Signals",
        renewUrl: `${APP_URL}/p/vip`,
      }),
  },
  {
    key: "lead_confirmation",
    label: "Lead confirmation",
    audience: "Buyer",
    live: true,
    description: "Auto-reply to someone who signs up on a lead page.",
    render: () =>
      confirmationEmail({
        leadName: "Asha Patel",
        pageTitle: "Free Trading Guide",
        body: "Thanks for signing up! Your guide is on the way.",
      }),
  },
  {
    key: "lead_magnet",
    label: "Lead magnet delivery",
    audience: "Buyer",
    live: true,
    description: "Delivers the downloadable file to a new lead.",
    render: () =>
      leadMagnetDeliveryEmail({
        leadName: "Asha Patel",
        pageTitle: "Free Trading Guide",
        downloadUrl: `${APP_URL}/download/x`,
      }),
  },
  {
    key: "recovery_1",
    label: "Cart recovery #1",
    audience: "Buyer",
    live: true,
    description: "First nudge after an abandoned checkout.",
    render: () =>
      recoveryEmail1({
        buyerName: "Asha Patel",
        sellerName: "Acme Studio",
        productName: "Pro Trading Course",
        productImage: IMG,
        productPrice: 1499,
        recoveryUrl: `${APP_URL}/p/course/checkout?r=x`,
      }),
  },
  {
    key: "recovery_2",
    label: "Cart recovery #2 (coupon)",
    audience: "Buyer",
    live: true,
    description: "Second nudge with an optional discount coupon.",
    render: () =>
      recoveryEmail2({
        buyerName: "Asha Patel",
        sellerName: "Acme Studio",
        productName: "Pro Trading Course",
        productImage: IMG,
        productPrice: 1499,
        recoveryUrl: `${APP_URL}/p/course/checkout?r=x`,
        couponCode: "SAVE10",
        couponLabel: "10% off",
      }),
  },
  {
    key: "recovery_alt",
    label: "Cart recovery (alt facade)",
    audience: "Buyer",
    live: false,
    description: "Alternative recovery template (the legacy ones are live).",
    render: () =>
      abandonedRecovery1Email({
        buyer_name: "Asha Patel",
        seller_name: "Acme Studio",
        product_name: "Pro Trading Course",
        product_image: IMG,
        product_price: 1499,
        recovery_url: `${APP_URL}/p/course/checkout?r=x`,
      }),
  },
];
