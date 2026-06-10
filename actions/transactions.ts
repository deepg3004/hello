"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/account-context";
import { getRazorpay } from "@/lib/razorpay";
import { loadSellerGatewayKeys } from "@/lib/gateway-loader";
import { getGateway } from "@/lib/gateways";
import { refundReversal } from "@/lib/pricing";
import {
  reversePlatformWalletFee,
  reverseFulfillmentForOrder,
} from "@/lib/order-reversal";

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
  const actor = await requireActor("transactions.view");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  let query = admin
    .from("orders")
    .select(
      "id, buyer_name, buyer_email, buyer_phone, amount, platform_commission, seller_amount, status, payment_gateway, gateway_payment_id, currency, coupon_id, discount_amount, utm_source, utm_medium, utm_campaign, created_at, paid_at, pages(title, slug)",
    )
    .eq("seller_user_id", ctx.ownerId)
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
 * Resend a paid order's delivery (receipt + access links) to the buyer — for
 * when they lost the email. Re-runs the same idempotent fulfilment the checkout
 * uses (downloads/course/Telegram/Discord re-issued; receipt re-sent). Scoped to
 * the order's owner.
 */
/**
 * Decline a buyer's refund request without issuing money. Flips the tracked
 * status to 'declined' (the request leaves the seller's queue). Issuing an
 * actual refund is handled by refundOrderAction, which moves the order to
 * 'refunded' and thereby supersedes the request.
 */
export async function declineRefundRequestAction(
  orderId: string,
): Promise<{ ok: boolean; message?: string }> {
  const actor = await requireActor("transactions.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, seller_user_id, refund_request_status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, message: "Order not found" };
  if (order.seller_user_id !== ctx.ownerId) {
    return { ok: false, message: "You can only manage your own orders." };
  }
  if (order.refund_request_status !== "requested") {
    return { ok: false, message: "No open refund request on this order." };
  }

  const { error } = await admin
    .from("orders")
    .update({ refund_request_status: "declined" })
    .eq("id", orderId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/transactions");
  return { ok: true };
}

export async function resendOrderDeliveryAction(
  orderId: string,
): Promise<{ ok: boolean; message?: string }> {
  const actor = await requireActor("transactions.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, page_id, product_id, seller_user_id, buyer_email, buyer_name, amount, currency, status, source",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, message: "Order not found" };
  if (order.seller_user_id !== ctx.ownerId) {
    return { ok: false, message: "You can only resend your own orders." };
  }
  if (order.status !== "paid") {
    return { ok: false, message: "Only paid orders can be resent." };
  }

  try {
    if (order.source === "cart") {
      const { fulfillCartOrder } = await import("@/lib/cart-fulfillment");
      await fulfillCartOrder(
        {
          id: order.id,
          buyer_email: order.buyer_email,
          buyer_name: order.buyer_name,
          seller_user_id: order.seller_user_id,
        },
        admin,
      );
    } else {
      const { deliverOrderProducts } = await import("@/lib/order-fulfillment");
      await deliverOrderProducts(
        {
          id: order.id,
          page_id: order.page_id,
          product_id: order.product_id,
          seller_user_id: order.seller_user_id,
          buyer_email: order.buyer_email,
          buyer_name: order.buyer_name,
          amount: Number(order.amount),
          currency: order.currency,
        },
        admin,
      );
    }
  } catch (e) {
    console.error("[resendOrderDeliveryAction] failed", e);
    return { ok: false, message: "Couldn't resend — try again." };
  }
  return { ok: true, message: `Delivery resent to ${order.buyer_email}` };
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
export async function refundOrderAction(
  orderId: string,
  amountRupees?: number,
): Promise<RefundResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();

  // Pull the order + ledger context we need for both authorization and the
  // reversal. (Loaded BEFORE the auth decision because a seller may only refund
  // their own seller-gateway orders.)
  const { data: order, error: loadErr } = await admin
    .from("orders")
    .select(
      "id, status, gateway_payment_id, gateway_order_id, payment_gateway, amount, seller_amount, platform_commission, seller_user_id, gateway_owner",
    )
    .eq("id", orderId)
    .single();
  if (loadErr || !order) {
    return { ok: false, message: "Order not found" };
  }

  // Authorization: platform admins can refund ANY order; a seller (with
  // transactions.manage) can refund THEIR OWN orders that were charged on the
  // seller's own gateway. Platform-gateway orders stay admin-only.
  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  const isAdmin = !!profile?.is_admin;
  if (!isAdmin) {
    if (order.gateway_owner !== "seller") {
      return {
        ok: false,
        message:
          "This order was charged on the platform gateway — only an admin can refund it.",
      };
    }
    const actor = await requireActor("transactions.manage");
    if (!actor.ok) return { ok: false, message: actor.error };
    if (actor.ctx.ownerId !== order.seller_user_id) {
      return { ok: false, message: "You can only refund your own orders." };
    }
  }

  if (order.status !== "paid" && order.status !== "partially_refunded") {
    return {
      ok: false,
      message: `Order is ${order.status} — only paid orders can be refunded`,
    };
  }

  // The provider id to refund against differs by gateway: Cashfree refunds key
  // off the ORDER id (always stored in gateway_order_id, in both the in-app and
  // webhook confirm paths), Razorpay off the PAYMENT id (gateway_payment_id).
  const isCashfree = order.payment_gateway === "cashfree";
  const refundRef = isCashfree ? order.gateway_order_id : order.gateway_payment_id;
  if (!refundRef) {
    return {
      ok: false,
      message: "Order has no gateway payment reference — cannot refund",
    };
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const gross = Number(order.amount);
  const requestedPartial =
    typeof amountRupees === "number" && round2(amountRupees) < gross;
  // A "partial-capable" run is either an explicit partial amount OR refunding
  // an order that's already partially refunded. These need the migration-037
  // refunded_amount column; a plain full refund of a `paid` order does NOT, so
  // that path stays byte-for-byte compatible (safe before the migration).
  const partialPath = requestedPartial || order.status === "partially_refunded";

  let prevRefunded = 0;
  let refundAmt = gross;
  if (partialPath) {
    const { data: rr, error: rrErr } = await admin
      .from("orders")
      .select("refunded_amount")
      .eq("id", orderId)
      .maybeSingle();
    if (rrErr) {
      return {
        ok: false,
        message:
          "Partial refunds need migration 037 applied (orders.refunded_amount).",
      };
    }
    prevRefunded = Number(rr?.refunded_amount ?? 0);
    const remaining = round2(gross - prevRefunded);
    if (remaining <= 0) {
      return { ok: false, message: "Order is already fully refunded." };
    }
    refundAmt = requestedPartial ? round2(amountRupees!) : remaining;
    if (refundAmt <= 0 || refundAmt > remaining) {
      return {
        ok: false,
        message: `Enter an amount between ₹1 and ₹${remaining}.`,
      };
    }
  }

  // ── Gateway refund — route through the order's OWN gateway. Seller-gateway
  //    orders (gateway_owner='seller') were charged on the seller's account, so
  //    they must be refunded there via the provider adapter; platform orders use
  //    the platform Razorpay client. Surface failures BEFORE touching the ledger.
  let refundId: string;
  try {
    if (order.gateway_owner === "seller") {
      const keys = await loadSellerGatewayKeys(order.seller_user_id);
      if (!keys) {
        return { ok: false, message: "Seller gateway not connected — cannot refund." };
      }
      // Pick the id the driver expects (Cashfree=order id, Razorpay=payment id).
      const targetId =
        keys.gateway_type === "cashfree"
          ? order.gateway_order_id
          : order.gateway_payment_id;
      if (!targetId) {
        return { ok: false, message: "Order has no gateway reference — cannot refund." };
      }
      const r = await getGateway(keys.gateway_type).refund(keys, {
        paymentId: targetId,
        amountPaise: Math.round(refundAmt * 100),
        notes: { invoxai_order_id: orderId, invoxai_initiator: user.id },
      });
      refundId = r.refundId;
    } else {
      const razorpay = getRazorpay();
      const refund = await razorpay.payments.refund(refundRef, {
        amount: Math.round(refundAmt * 100), // paise
        speed: "normal",
        notes: { invoxai_order_id: orderId, invoxai_initiator: user.id },
      });
      refundId = (refund as unknown as { id: string }).id;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gateway refund failed";
    return { ok: false, message };
  }

  const now = new Date().toISOString();

  if (!partialPath) {
    // ── Full refund of a `paid` order — legacy path, unchanged ──────────────
    const { data: updatedRows } = await admin
      .from("orders")
      .update({ status: "refunded", refund_id: refundId, refunded_at: now })
      .eq("id", orderId)
      .eq("status", "paid")
      .select("id");
    if (!updatedRows || updatedRows.length === 0) {
      return { ok: true, refund_id: refundId };
    }
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
    await admin
      .from("affiliate_payouts")
      .update({ status: "reversed", reversed_at: now })
      .eq("order_id", orderId)
      .in("status", ["pending", "paid"]);
    // Reverse the platform wallet fee + restore stock + revoke buyer access.
    // Best-effort; runs once (guarded by the status transition above).
    await reversePlatformWalletFee(orderId, order.seller_user_id, admin);
    await reverseFulfillmentForOrder(orderId, admin);
    return { ok: true, refund_id: refundId };
  }

  // ── Partial path ─────────────────────────────────────────────────────────
  const newRefunded = round2(prevRefunded + refundAmt);
  const fully = newRefunded >= gross - 0.005;
  const newStatus = fully ? "refunded" : "partially_refunded";
  const { sellerReversal, commissionGiveback } = refundReversal(
    gross,
    Number(order.seller_amount),
    Number(order.platform_commission),
    refundAmt,
  );

  // Guarded so a concurrent click can't double-apply.
  const { data: updatedRows } = await admin
    .from("orders")
    .update({
      status: newStatus,
      refunded_amount: newRefunded,
      refund_id: refundId,
      refunded_at: now,
    })
    .eq("id", orderId)
    .in("status", ["paid", "partially_refunded"])
    .select("id");
  if (!updatedRows || updatedRows.length === 0) {
    return { ok: true, refund_id: refundId };
  }

  await admin.from("transactions").insert([
    {
      user_id: order.seller_user_id,
      order_id: orderId,
      type: "refund",
      amount: -sellerReversal,
      status: "completed",
      reference_id: refundId,
      notes: `Refund ${refundId} — ₹${refundAmt} ${fully ? "(final)" : "partial"} reversal`,
    },
    {
      user_id: order.seller_user_id,
      order_id: orderId,
      type: "refund_commission",
      amount: commissionGiveback,
      status: "completed",
      reference_id: refundId,
      notes: `Refund ${refundId} — commission give-back (₹${refundAmt})`,
    },
  ]);

  // Affiliate clawback + wallet-fee/stock/access reversal only once the order is
  // fully refunded (the per-order platform fee is fixed, not proportional).
  if (fully) {
    await admin
      .from("affiliate_payouts")
      .update({ status: "reversed", reversed_at: now })
      .eq("order_id", orderId)
      .in("status", ["pending", "paid"]);
    await reversePlatformWalletFee(orderId, order.seller_user_id, admin);
    await reverseFulfillmentForOrder(orderId, admin);
  }

  return { ok: true, refund_id: refundId };
}
