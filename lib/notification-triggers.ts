// Notification triggers — fire WhatsApp + email to sellers when
// significant events happen. Every function is best-effort and wrapped
// in try/catch so notification failures never affect the core flow.

import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp, WA_TEMPLATES } from "@/lib/twilio";
import {
  isEmailEventEnabled,
  isEventEnabled,
  type NotificationEventKey,
  type NotificationsConfig,
} from "@/lib/notifications-config";

// ---- Internal helpers ------------------------------------------------------

interface SellerPrefs {
  email: string;
  full_name: string | null;
  config: NotificationsConfig | null;
  whatsapp_verified_number: string | null;
}

async function loadSellerPrefs(userId: string): Promise<SellerPrefs | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("user_profiles")
      .select(
        "email, full_name, notifications_config, whatsapp_verified_number",
      )
      .eq("id", userId)
      .single();
    if (error || !data) return null;
    return {
      email: data.email,
      full_name: data.full_name,
      config: (data.notifications_config as NotificationsConfig | null) ?? null,
      whatsapp_verified_number: data.whatsapp_verified_number,
    };
  } catch (e) {
    console.error("[notify] loadSellerPrefs failed", e);
    return null;
  }
}

function formatIst(date?: Date | string | null): string {
  const d = date ? new Date(date) : new Date();
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function inr(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/**
 * Decide whether we should fire WhatsApp for this event. Returns the verified
 * number to send to, or null if any gate fails.
 */
function shouldFireWa(
  prefs: SellerPrefs,
  event: NotificationEventKey,
): string | null {
  if (!prefs.whatsapp_verified_number) return null;
  if (!isEventEnabled(prefs.config, event)) return null;
  return prefs.whatsapp_verified_number;
}

// ---- Trigger: new sale -----------------------------------------------------

export interface OrderForNotify {
  id: string;
  seller_user_id: string;
  buyer_name: string | null;
  buyer_email: string;
  amount: number | string;
  seller_amount: number | string;
  product_id?: string | null;
  product?: { name?: string | null } | null;
  page_id?: string | null;
}

export async function notifyNewSale(order: OrderForNotify): Promise<void> {
  try {
    const prefs = await loadSellerPrefs(order.seller_user_id);
    if (!prefs) return;

    // Resolve product name lazily if not provided.
    let productName = order.product?.name ?? null;
    if (!productName && order.product_id) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("products")
        .select("name")
        .eq("id", order.product_id)
        .single();
      productName = data?.name ?? null;
    }

    const time = formatIst();

    // WhatsApp
    const to = shouldFireWa(prefs, "new_sale");
    if (to) {
      await sendWhatsApp(to, WA_TEMPLATES.NEW_SALE, [
        order.buyer_name ?? "Customer",
        productName ?? "Your product",
        inr(order.amount),
        inr(order.seller_amount),
        time,
      ]);
    }

    // Email (defaults on)
    if (isEmailEventEnabled(prefs.config, "new_sale")) {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: prefs.email,
        subject: `New sale — ₹${inr(order.amount)} on ${productName ?? "InvoxAI"}`,
        html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18181b">
          <p>Hi ${prefs.full_name ?? ""},</p>
          <p><strong>You have a new sale! 🎉</strong></p>
          <table style="border-collapse:collapse">
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Buyer</td><td>${order.buyer_name ?? "Customer"} (${order.buyer_email})</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Product</td><td>${productName ?? "—"}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Amount</td><td>₹${inr(order.amount)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Your earnings</td><td>₹${inr(order.seller_amount)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Time</td><td>${time}</td></tr>
          </table>
          <p style="margin-top:16px"><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io"}/dashboard/transactions" style="color:#0ea5e9">View in dashboard →</a></p>
        </div>`,
      });
    }
  } catch (e) {
    console.error("[notify] notifyNewSale failed", e);
  }
}

// ---- Trigger: payment failed ----------------------------------------------

export interface FailedOrderForNotify {
  seller_user_id: string;
  buyer_name?: string | null;
  buyer_email: string;
  page_id?: string | null;
  page_title?: string | null;
  amount: number | string;
  reason?: string | null;
}

export async function notifyPaymentFailed(order: FailedOrderForNotify): Promise<void> {
  try {
    const prefs = await loadSellerPrefs(order.seller_user_id);
    if (!prefs) return;

    let pageTitle = order.page_title ?? null;
    if (!pageTitle && order.page_id) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("pages")
        .select("title")
        .eq("id", order.page_id)
        .single();
      pageTitle = data?.title ?? null;
    }

    const time = formatIst();
    const reason = order.reason ?? "Unknown";

    const to = shouldFireWa(prefs, "payment_failed");
    if (to) {
      await sendWhatsApp(to, WA_TEMPLATES.PAYMENT_FAILED, [
        order.buyer_name ?? "Customer",
        order.buyer_email,
        pageTitle ?? "—",
        inr(order.amount),
        reason,
        time,
      ]);
    }

    if (isEmailEventEnabled(prefs.config, "payment_failed")) {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: prefs.email,
        subject: `Payment failed on ${pageTitle ?? "InvoxAI"} (₹${inr(order.amount)})`,
        html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18181b">
          <p>Hi ${prefs.full_name ?? ""},</p>
          <p><strong>A buyer's payment failed.</strong> You can reach out and recover them from the Customers tab.</p>
          <table style="border-collapse:collapse">
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Buyer</td><td>${order.buyer_name ?? "Customer"} (${order.buyer_email})</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Page</td><td>${pageTitle ?? "—"}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Amount</td><td>₹${inr(order.amount)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Reason</td><td>${reason}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Time</td><td>${time}</td></tr>
          </table>
        </div>`,
      });
    }
  } catch (e) {
    console.error("[notify] notifyPaymentFailed failed", e);
  }
}

// ---- Trigger: new lead ----------------------------------------------------

export interface LeadForNotify {
  seller_user_id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  page_id?: string | null;
  page_title?: string | null;
}

export async function notifyNewLead(lead: LeadForNotify): Promise<void> {
  try {
    const prefs = await loadSellerPrefs(lead.seller_user_id);
    if (!prefs) return;

    let pageTitle = lead.page_title ?? null;
    if (!pageTitle && lead.page_id) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("pages")
        .select("title")
        .eq("id", lead.page_id)
        .single();
      pageTitle = data?.title ?? null;
    }

    const time = formatIst();
    const to = shouldFireWa(prefs, "new_lead");
    if (to) {
      await sendWhatsApp(to, WA_TEMPLATES.NEW_LEAD, [
        lead.name ?? "Anonymous",
        lead.email,
        lead.phone ?? "—",
        pageTitle ?? "—",
        time,
      ]);
    }
    // Lead capture endpoint already sends its own seller email — we don't
    // duplicate here.
  } catch (e) {
    console.error("[notify] notifyNewLead failed", e);
  }
}

// ---- Trigger: payout completed --------------------------------------------

export interface PayoutForNotify {
  user_id: string;
  amount: number | string;
  bank_last4?: string | null;
  /** Razorpay/Cashfree payout id or our internal reference. */
  payout_id?: string | null;
  utr?: string | null;
}

export async function notifyPayoutComplete(payout: PayoutForNotify): Promise<void> {
  try {
    const prefs = await loadSellerPrefs(payout.user_id);
    if (!prefs) return;

    // Fetch the bank last 4 if not supplied.
    let last4 = payout.bank_last4 ?? null;
    if (!last4) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("user_profiles")
        .select("bank_account_number")
        .eq("id", payout.user_id)
        .single();
      last4 = (data?.bank_account_number ?? "").slice(-4) || null;
    }

    const to = shouldFireWa(prefs, "payout_completed");
    if (to) {
      await sendWhatsApp(to, WA_TEMPLATES.PAYOUT_DONE, [
        inr(payout.amount),
        last4 ?? "----",
        payout.utr ?? payout.payout_id ?? "—",
      ]);
    }
    // Email side is already sent by the payout webhook — left as-is to avoid
    // duplicating messages on the seller.
  } catch (e) {
    console.error("[notify] notifyPayoutComplete failed", e);
  }
}

// ---- Trigger: payout initiated --------------------------------------------

export async function notifyPayoutInitiated(payout: PayoutForNotify): Promise<void> {
  try {
    const prefs = await loadSellerPrefs(payout.user_id);
    if (!prefs) return;

    const to = shouldFireWa(prefs, "payout_initiated");
    if (to) {
      // We don't have a dedicated "initiated" template registered with MSG91
      // by default — re-use the PAYOUT_DONE shape so we still deliver
      // something useful without needing another template approval.
      await sendWhatsApp(to, WA_TEMPLATES.PAYOUT_INITIATED, [
        inr(payout.amount),
        (payout.bank_last4 ?? "----"),
        payout.payout_id ?? "—",
      ]);
    }
  } catch (e) {
    console.error("[notify] notifyPayoutInitiated failed", e);
  }
}

// ---- Trigger: KYC update --------------------------------------------------

export async function notifyKycUpdate(
  userId: string,
  status: "approved" | "rejected" | "pending",
  reason?: string | null,
): Promise<void> {
  try {
    const prefs = await loadSellerPrefs(userId);
    if (!prefs) return;
    const to = shouldFireWa(prefs, "kyc_update");
    if (to) {
      await sendWhatsApp(to, WA_TEMPLATES.KYC_UPDATE, [
        status.toUpperCase(),
        reason ?? "—",
        formatIst(),
      ]);
    }
  } catch (e) {
    console.error("[notify] notifyKycUpdate failed", e);
  }
}
