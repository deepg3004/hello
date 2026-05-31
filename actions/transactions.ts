"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getRazorpay } from "@/lib/razorpay";

export interface TransactionsFilter {
  from?: string;     // ISO date
  to?: string;       // ISO date
  status?: string;   // empty = any
  page_id?: string;
  search?: string;   // buyer name or email
}

export interface ExportResult {
  ok: boolean;
  message?: string;
  csv?: string;
  filename?: string;
}

const csvEscape = (s: unknown): string => {
  const v = s == null ? "" : String(s);
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
};

export async function exportTransactionsCsvAction(
  filter: TransactionsFilter,
): Promise<ExportResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  let query = admin
    .from("orders")
    .select(
      "id, buyer_name, buyer_email, buyer_phone, amount, platform_commission, seller_amount, status, payment_gateway, gateway_payment_id, currency, coupon_id, discount_amount, utm_source, utm_medium, utm_campaign, created_at, paid_at, pages(title, slug)",
    )
    .eq("seller_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (filter.from) query = query.gte("created_at", filter.from);
  if (filter.to) query = query.lte("created_at", filter.to);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.page_id) query = query.eq("page_id", filter.page_id);
  if (filter.search) {
    const s = `%${filter.search}%`;
    query = query.or(`buyer_name.ilike.${s},buyer_email.ilike.${s}`);
  }

  const { data, error } = await query;
  if (error) return { ok: false, message: error.message };

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    buyer_name: string | null;
    buyer_email: string;
    buyer_phone: string | null;
    amount: number;
    platform_commission: number;
    seller_amount: number;
    status: string;
    payment_gateway: string | null;
    gateway_payment_id: string | null;
    currency: string;
    discount_amount: number | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    created_at: string;
    paid_at: string | null;
    pages: { title: string; slug: string } | { title: string; slug: string }[] | null;
  }>;

  const header = [
    "order_id",
    "created_at",
    "paid_at",
    "page_title",
    "page_slug",
    "buyer_name",
    "buyer_email",
    "buyer_phone",
    "amount",
    "platform_commission",
    "seller_amount",
    "discount",
    "currency",
    "status",
    "gateway",
    "gateway_payment_id",
    "utm_source",
    "utm_medium",
    "utm_campaign",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    const page = Array.isArray(r.pages) ? r.pages[0] : r.pages;
    lines.push(
      [
        r.id,
        r.created_at,
        r.paid_at ?? "",
        page?.title ?? "",
        page?.slug ?? "",
        r.buyer_name ?? "",
        r.buyer_email,
        r.buyer_phone ?? "",
        r.amount,
        r.platform_commission,
        r.seller_amount,
        r.discount_amount ?? 0,
        r.currency,
        r.status,
        r.payment_gateway ?? "",
        r.gateway_payment_id ?? "",
        r.utm_source ?? "",
        r.utm_medium ?? "",
        r.utm_campaign ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  return {
    ok: true,
    csv: lines.join("\n"),
    filename: `invoxai-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

export interface RefundResult {
  ok: boolean;
  message?: string;
  refund_id?: string;
}

/**
 * Admin-only full refund.
 *
 * Sequence (audit #2 — refund ledger reversal, NOW IMPLEMENTED):
 *   1. Authn check — caller must be signed in AND user_profiles.is_admin.
 *   2. Status guard — only `paid` orders can be refunded (no double-refund,
 *      no refunding pending/failed orders).
 *   3. Call Razorpay payments.refund() to actually return the money. If
 *      Razorpay rejects (already refunded, expired window, etc.) we surface
 *      the message and DON'T touch our ledger.
 *   4. Update orders.status='refunded' (guarded by status='paid' so a
 *      concurrent admin clicking Refund twice can't double-reverse).
 *   5. Insert negating ledger rows so seller's pending balance and the
 *      platform's commission earnings reflect the reversal.
 *   6. Mark any affiliate_payouts on this order as 'reversed' so we don't
 *      pay commission on a refunded sale.
 *
 * Partial refunds and subscription charges are NOT handled here yet —
 * see app/api/webhooks/razorpay/subscription for the subscription path,
 * and a future product decision for partial-refund UX.
 */
export async function refundOrderAction(orderId: string): Promise<RefundResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) {
    return { ok: false, message: "Refunds are admin-only" };
  }

  // Pull the order + ledger context we need for the reversal.
  const { data: order, error: loadErr } = await admin
    .from("orders")
    .select(
      "id, status, gateway_payment_id, amount, seller_amount, platform_commission, seller_user_id",
    )
    .eq("id", orderId)
    .single();
  if (loadErr || !order) {
    return { ok: false, message: "Order not found" };
  }
  if (order.status !== "paid") {
    return {
      ok: false,
      message: `Order is ${order.status} — only paid orders can be refunded`,
    };
  }
  if (!order.gateway_payment_id) {
    return {
      ok: false,
      message: "Order has no Razorpay payment id — cannot refund",
    };
  }

  // ── Razorpay refund — surface failures BEFORE touching our ledger ───────
  let refundId: string;
  try {
    const razorpay = getRazorpay();
    const refund = await razorpay.payments.refund(order.gateway_payment_id, {
      amount: Math.round(Number(order.amount) * 100), // paise
      speed: "normal",
      notes: { invoxai_order_id: orderId, invoxai_initiator: user.id },
    });
    refundId = (refund as unknown as { id: string }).id;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Razorpay refund failed";
    return { ok: false, message };
  }

  // ── Flip status — guarded so a concurrent admin click can't double-flip
  const { data: updatedRows } = await admin
    .from("orders")
    .update({
      status: "refunded",
      refund_id: refundId,
      refunded_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "paid")
    .select("id");
  if (!updatedRows || updatedRows.length === 0) {
    // Someone else got there first (or refund webhook ran). The Razorpay
    // refund is real but our ledger already shows reversed — exit cleanly.
    return { ok: true, refund_id: refundId };
  }

  // ── Negate the ledger so seller balance + platform commission unwind ────
  await admin.from("transactions").insert([
    {
      user_id: order.seller_user_id,
      order_id: orderId,
      type: "refund",
      amount: -Number(order.seller_amount),
      status: "completed",
      reference_id: refundId,
      notes: `Refund ${refundId} — sale reversal`,
    },
    {
      user_id: order.seller_user_id,
      order_id: orderId,
      type: "refund_commission",
      amount: Number(order.platform_commission),
      status: "completed",
      reference_id: refundId,
      notes: `Refund ${refundId} — commission give-back`,
    },
  ]);

  // ── Affiliate clawback — mark any pending/paid commission as reversed ──
  await admin
    .from("affiliate_payouts")
    .update({ status: "reversed", reversed_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .in("status", ["pending", "paid"]);

  return { ok: true, refund_id: refundId };
}
