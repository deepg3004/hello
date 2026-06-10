// Notification triggers — fire a seller-facing event across every channel the
// seller has enabled. Each function builds per-channel payloads and hands them
// to the unified notification engine (lib/notification-engine), which gates on
// the event registry + the seller's saved preferences and sends best-effort.
//
// All functions are wrapped in try/catch so a notification failure never
// affects the core flow (a payment, a lead capture).

import { createAdminClient } from "@/lib/supabase/admin";
import { WA_TEMPLATES } from "@/lib/twilio";
import { dispatchNotification } from "@/lib/notification-engine";
import { APP_URL } from "@/lib/emails/layout";

// ---- Internal helpers ------------------------------------------------------

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
    const buyer = order.buyer_name ?? "Customer";
    const product = productName ?? "Your product";

    await dispatchNotification({
      event: "new_sale",
      recipientUserId: order.seller_user_id,
      payloads: {
        whatsapp: {
          template: WA_TEMPLATES.NEW_SALE,
          variables: [
            buyer,
            product,
            inr(order.amount),
            inr(order.seller_amount),
            time,
          ],
        },
        sms: {
          message: `New sale on InvoxAI: ₹${inr(order.amount)} for ${product} (buyer ${buyer}). You earned ₹${inr(order.seller_amount)}.`,
        },
        email: {
          subject: `New sale — ₹${inr(order.amount)} on ${productName ?? "InvoxAI"}`,
          html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18181b">
          <p><strong>You have a new sale! 🎉</strong></p>
          <table style="border-collapse:collapse">
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Buyer</td><td>${buyer} (${order.buyer_email})</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Product</td><td>${productName ?? "—"}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Amount</td><td>₹${inr(order.amount)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Your earnings</td><td>₹${inr(order.seller_amount)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Time</td><td>${time}</td></tr>
          </table>
          <p style="margin-top:16px"><a href="${APP_URL}/dashboard/transactions" style="color:#0ea5e9">View in dashboard →</a></p>
        </div>`,
        },
      },
    });
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

export async function notifyPaymentFailed(
  order: FailedOrderForNotify,
): Promise<void> {
  try {
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
    const buyer = order.buyer_name ?? "Customer";
    const page = pageTitle ?? "—";

    await dispatchNotification({
      event: "payment_failed",
      recipientUserId: order.seller_user_id,
      payloads: {
        inApp: {
          title: "Payment failed",
          body: `${buyer} couldn't pay ₹${inr(order.amount)} on ${page}. Recover them from Customers.`,
          link: "/dashboard/customers",
          meta: { amount: order.amount, page_id: order.page_id ?? null },
        },
        whatsapp: {
          template: WA_TEMPLATES.PAYMENT_FAILED,
          variables: [
            buyer,
            order.buyer_email,
            page,
            inr(order.amount),
            reason,
            time,
          ],
        },
        sms: {
          message: `Payment failed on InvoxAI: ₹${inr(order.amount)} on ${page} (buyer ${buyer}). Reason: ${reason}.`,
        },
        email: {
          subject: `Payment failed on ${pageTitle ?? "InvoxAI"} (₹${inr(order.amount)})`,
          html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#18181b">
          <p><strong>A buyer's payment failed.</strong> You can reach out and recover them from the Customers tab.</p>
          <table style="border-collapse:collapse">
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Buyer</td><td>${buyer} (${order.buyer_email})</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Page</td><td>${page}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Amount</td><td>₹${inr(order.amount)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Reason</td><td>${reason}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#71717a">Time</td><td>${time}</td></tr>
          </table>
        </div>`,
        },
      },
    });
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
    const name = lead.name ?? "Anonymous";
    const page = pageTitle ?? "—";

    // Email for new_lead is intentionally omitted — the lead-capture endpoint
    // sends its own seller email, so the registry excludes "email" here.
    await dispatchNotification({
      event: "new_lead",
      recipientUserId: lead.seller_user_id,
      payloads: {
        inApp: {
          title: "New lead captured",
          body: `${name} just submitted a form on ${page}.`,
          link: "/dashboard/leads",
          meta: { page_id: lead.page_id ?? null },
        },
        whatsapp: {
          template: WA_TEMPLATES.NEW_LEAD,
          variables: [name, lead.email, lead.phone ?? "—", page, time],
        },
        sms: {
          message: `New lead on InvoxAI: ${name} (${lead.phone ?? lead.email}) on ${page}.`,
        },
      },
    });
  } catch (e) {
    console.error("[notify] notifyNewLead failed", e);
  }
}

// Payout & KYC notifications are not wired yet (no seller payouts / KYC). Their
// events remain in the registry so preferences + future dispatch are ready.
