"use server";

// Buyer self-service: wishlist + saved address book. Every action is gated by
// a verified buyer-portal session (the signed BUYER_COOKIE → email); all rows
// are scoped to that email. Tolerant of a not-yet-applied migration 085 —
// missing-table errors degrade to a friendly { ok:false } instead of throwing.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { BUYER_COOKIE, verifyBuyerSession } from "@/lib/buyer-portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications/create";

type Result = { ok: boolean; message?: string };

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function buyerEmail(): string | null {
  try {
    const raw = cookies().get(BUYER_COOKIE)?.value;
    if (!raw) return null;
    return verifyBuyerSession(raw);
  } catch {
    return null;
  }
}

const NOT_SIGNED_IN = "Sign in at /account to use this.";

export async function addToWishlistAction(pageId: string): Promise<Result> {
  const email = buyerEmail();
  if (!email) return { ok: false, message: NOT_SIGNED_IN };
  if (!pageId) return { ok: false, message: "Missing item." };

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id, title")
    .eq("id", pageId)
    .maybeSingle();
  if (!page) return { ok: false, message: "Item not found." };

  const { error } = await admin
    .from("buyer_wishlist")
    .upsert(
      {
        buyer_email: email.toLowerCase(),
        page_id: page.id,
        seller_user_id: page.user_id,
        title: page.title,
      },
      { onConflict: "buyer_email,page_id" },
    );
  if (error) return { ok: false, message: "Couldn't save. Try again." };
  revalidatePath("/account");
  return { ok: true };
}

export async function removeFromWishlistAction(id: string): Promise<Result> {
  const email = buyerEmail();
  if (!email) return { ok: false, message: NOT_SIGNED_IN };
  const admin = createAdminClient();
  const { error } = await admin
    .from("buyer_wishlist")
    .delete()
    .eq("id", id)
    .eq("buyer_email", email.toLowerCase());
  if (error) return { ok: false, message: "Couldn't remove." };
  revalidatePath("/account");
  return { ok: true };
}

export interface AddressInput {
  id?: string;
  full_name: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  pincode: string;
  country?: string;
  is_default?: boolean;
}

export async function saveAddressAction(input: AddressInput): Promise<Result> {
  const email = buyerEmail();
  if (!email) return { ok: false, message: NOT_SIGNED_IN };

  const full_name = input.full_name?.trim();
  const line1 = input.line1?.trim();
  const city = input.city?.trim();
  const pincode = input.pincode?.trim();
  if (!full_name || !line1 || !city || !pincode) {
    return { ok: false, message: "Name, address, city and PIN are required." };
  }

  const admin = createAdminClient();
  const lower = email.toLowerCase();
  const row = {
    buyer_email: lower,
    full_name,
    phone: input.phone?.trim() || null,
    line1,
    line2: input.line2?.trim() || null,
    city,
    state: input.state?.trim() || null,
    pincode,
    country: input.country?.trim() || "India",
    is_default: !!input.is_default,
    updated_at: new Date().toISOString(),
  };

  let savedId = input.id;
  if (input.id) {
    const { error } = await admin
      .from("buyer_addresses")
      .update(row)
      .eq("id", input.id)
      .eq("buyer_email", lower);
    if (error) return { ok: false, message: "Couldn't save address." };
  } else {
    const { data, error } = await admin
      .from("buyer_addresses")
      .insert(row)
      .select("id")
      .single();
    if (error) return { ok: false, message: "Couldn't save address." };
    savedId = data?.id;
  }

  // Only one default per buyer.
  if (row.is_default && savedId) {
    await admin
      .from("buyer_addresses")
      .update({ is_default: false })
      .eq("buyer_email", lower)
      .neq("id", savedId);
  }

  revalidatePath("/account");
  return { ok: true };
}

export interface DefaultAddress {
  full_name: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  pincode: string;
  country: string;
}

/** The signed-in buyer's default (or most recent) saved address, for checkout
 *  autofill. Returns null when not signed in, none saved, or the table is
 *  absent (migration 085 not yet applied). */
export async function getDefaultBuyerAddressAction(): Promise<{
  ok: boolean;
  address: DefaultAddress | null;
}> {
  const email = buyerEmail();
  if (!email) return { ok: false, address: null };
  const admin = createAdminClient();
  const { data } = await admin
    .from("buyer_addresses")
    .select("full_name, phone, line1, line2, city, state, pincode, country")
    .eq("buyer_email", email.toLowerCase())
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { ok: true, address: (data as DefaultAddress | null) ?? null };
}

export async function deleteAddressAction(id: string): Promise<Result> {
  const email = buyerEmail();
  if (!email) return { ok: false, message: NOT_SIGNED_IN };
  const admin = createAdminClient();
  const { error } = await admin
    .from("buyer_addresses")
    .delete()
    .eq("id", id)
    .eq("buyer_email", email.toLowerCase());
  if (error) return { ok: false, message: "Couldn't delete." };
  revalidatePath("/account");
  return { ok: true };
}

const CONTACT_TOPICS: Record<string, string> = {
  question: "Question about my order",
  refund: "Refund request",
  delivery: "Delivery / access issue",
  other: "Order enquiry",
};

/** Buyer → seller message about a specific order. Emails the seller (reply-to
 *  the buyer), so a buyer can ask for help / a refund without a public inbox.
 *  No DB row — it's a relayed email, gated by the buyer session + order match. */
export async function contactSellerAboutOrderAction(
  orderId: string,
  topic: string,
  message: string,
): Promise<Result> {
  const email = buyerEmail();
  if (!email) return { ok: false, message: NOT_SIGNED_IN };

  const body = (message ?? "").trim();
  if (body.length < 5) return { ok: false, message: "Please write a short message." };
  if (body.length > 4000) return { ok: false, message: "Message is too long." };

  // Light abuse guard: a handful of messages per buyer per hour.
  const rl = await rateLimit(`contact-seller:${email.toLowerCase()}`, 6, 3600);
  if (!rl.ok) {
    return { ok: false, message: "You've sent a few messages — please try again later." };
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, buyer_email, buyer_name, seller_user_id, amount, created_at, pages(title)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || (order.buyer_email ?? "").toLowerCase() !== email.toLowerCase()) {
    return { ok: false, message: "Order not found." };
  }

  const { data: seller } = await admin
    .from("user_profiles")
    .select("email, full_name")
    .eq("id", order.seller_user_id)
    .maybeSingle();
  if (!seller?.email) {
    return { ok: false, message: "Seller contact isn't available for this order." };
  }

  const page = Array.isArray(order.pages) ? order.pages[0] : order.pages;
  const subjectLabel = CONTACT_TOPICS[topic] ?? CONTACT_TOPICS.other;
  const shortId = String(order.id).slice(0, 8);

  const html = `
    <p>You have a new message from a buyer about an order.</p>
    <table style="border-collapse:collapse;font-size:14px">
      <tr><td style="padding:2px 12px 2px 0;color:#666">Topic</td><td><strong>${escapeHtml(subjectLabel)}</strong></td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#666">Order</td><td>#${escapeHtml(shortId)}${page?.title ? " · " + escapeHtml(page.title) : ""}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;color:#666">Buyer</td><td>${escapeHtml(order.buyer_name || "—")} &lt;${escapeHtml(order.buyer_email)}&gt;</td></tr>
    </table>
    <p style="margin-top:12px;white-space:pre-wrap;border-left:3px solid #e5e7eb;padding-left:12px;color:#111">${escapeHtml(body)}</p>
    <p style="margin-top:16px;color:#666;font-size:12px">Reply to this email to respond to the buyer directly.</p>
  `;

  const res = await sendEmail({
    to: seller.email,
    subject: `[Order #${shortId}] ${subjectLabel} — ${order.buyer_email}`,
    html,
    reply_to: order.buyer_email,
    sellerId: order.seller_user_id as string,
  });
  if (!res.ok && !res.skipped) {
    return { ok: false, message: "Couldn't send right now. Please try again." };
  }
  return { ok: true };
}

/**
 * Structured refund request on a PAID order. Unlike contactSeller (a relayed
 * email), this stamps a tracked status on the order so it lands in the seller's
 * transactions queue, and pings the seller (in-app bell + email). The seller
 * resolves it by issuing the existing refund or declining.
 */
export async function requestRefundAction(
  orderId: string,
  reason: string,
): Promise<Result> {
  const email = buyerEmail();
  if (!email) return { ok: false, message: NOT_SIGNED_IN };

  const note = (reason ?? "").trim();
  if (note.length < 5) return { ok: false, message: "Please tell the seller why (a short reason)." };
  if (note.length > 2000) return { ok: false, message: "Reason is too long." };

  const rl = await rateLimit(`refund-req:${email.toLowerCase()}`, 5, 3600);
  if (!rl.ok) {
    return { ok: false, message: "Too many requests — please try again later." };
  }

  const admin = createAdminClient();
  const { data: order, error: readErr } = await admin
    .from("orders")
    .select(
      "id, buyer_email, buyer_name, seller_user_id, amount, status, refund_request_status, pages(title)",
    )
    .eq("id", orderId)
    .maybeSingle();
  // Pre-migration tolerance: if the column doesn't exist yet, fail soft.
  if (readErr) return { ok: false, message: "Refund requests aren't available yet." };
  if (!order || (order.buyer_email ?? "").toLowerCase() !== email.toLowerCase()) {
    return { ok: false, message: "Order not found." };
  }
  if (order.status !== "paid") {
    return { ok: false, message: "Only paid orders can be refunded." };
  }
  if (order.refund_request_status === "requested") {
    return { ok: false, message: "You've already requested a refund for this order." };
  }

  const { error } = await admin
    .from("orders")
    .update({
      refund_request_status: "requested",
      refund_requested_at: new Date().toISOString(),
      refund_request_reason: note,
    })
    .eq("id", orderId);
  if (error) return { ok: false, message: "Couldn't submit. Please try again." };

  const page = Array.isArray(order.pages) ? order.pages[0] : order.pages;
  const shortId = String(order.id).slice(0, 8);

  // In-app bell — always reaches the seller regardless of their prefs.
  await createNotification({
    userId: order.seller_user_id as string,
    type: "refund_requested",
    title: "Refund requested",
    body: `${order.buyer_name || order.buyer_email} requested a refund of ₹${Number(
      order.amount ?? 0,
    ).toLocaleString("en-IN")} (order #${shortId}).`,
    link: "/dashboard/transactions",
    meta: { order_id: order.id, reason: note },
  });

  // Email the seller too (best-effort).
  const { data: seller } = await admin
    .from("user_profiles")
    .select("email")
    .eq("id", order.seller_user_id)
    .maybeSingle();
  if (seller?.email) {
    await sendEmail({
      to: seller.email,
      subject: `[Order #${shortId}] Refund requested — ${order.buyer_email}`,
      html: `
        <p>A buyer has requested a refund.</p>
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:2px 12px 2px 0;color:#666">Order</td><td>#${escapeHtml(shortId)}${page?.title ? " · " + escapeHtml(page.title) : ""}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;color:#666">Buyer</td><td>${escapeHtml(order.buyer_name || "—")} &lt;${escapeHtml(order.buyer_email)}&gt;</td></tr>
          <tr><td style="padding:2px 12px 2px 0;color:#666">Amount</td><td>₹${Number(order.amount ?? 0).toLocaleString("en-IN")}</td></tr>
        </table>
        <p style="margin-top:12px;white-space:pre-wrap;border-left:3px solid #e5e7eb;padding-left:12px;color:#111">${escapeHtml(note)}</p>
        <p style="margin-top:16px;color:#666;font-size:13px">Review it in your <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io"}/dashboard/transactions">transactions</a> — refund or decline from there.</p>
      `,
      reply_to: order.buyer_email,
      sellerId: order.seller_user_id as string,
    });
  }

  revalidatePath("/account");
  return { ok: true };
}

export async function setDefaultAddressAction(id: string): Promise<Result> {
  const email = buyerEmail();
  if (!email) return { ok: false, message: NOT_SIGNED_IN };
  const admin = createAdminClient();
  const lower = email.toLowerCase();
  const { error } = await admin
    .from("buyer_addresses")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("buyer_email", lower);
  if (error) return { ok: false, message: "Couldn't update." };
  await admin
    .from("buyer_addresses")
    .update({ is_default: false })
    .eq("buyer_email", lower)
    .neq("id", id);
  revalidatePath("/account");
  return { ok: true };
}
