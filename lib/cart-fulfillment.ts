// Shared fulfillment for multi-item cart orders (source='cart'). Called by BOTH
// the in-checkout verify-cart-payment route AND the seller-webhook fallback, so
// a cart order is fulfilled correctly however it gets confirmed. The caller must
// gate this on winning the pending→paid transition so it runs exactly once.
//
// Does: decrement stock per line item + send the itemized buyer receipt.
// Does NOT charge the wallet fee (each caller does that on its own transition).

import type { SupabaseClient } from "@supabase/supabase-js";

import { formatINR } from "@/lib/utils";

type DB = SupabaseClient;

interface OrderLite {
  id: string;
  buyer_email: string;
  buyer_name: string | null;
  seller_user_id: string;
}

export async function fulfillCartOrder(order: OrderLite, admin: DB): Promise<void> {
  const { data: items } = await admin
    .from("order_items")
    .select("product_id, variant_id, name_snapshot, quantity, line_amount")
    .eq("order_id", order.id);
  const lines = (items ?? []) as Array<{
    product_id: string | null;
    variant_id: string | null;
    name_snapshot: string;
    quantity: number;
    line_amount: number;
  }>;

  // Decrement stock per line — the variant's stock when the line has a variant,
  // else the product's. RPC clamps at 0; log-and-continue on any error.
  for (const l of lines) {
    for (let i = 0; i < l.quantity; i++) {
      try {
        if (l.variant_id) {
          await admin.rpc("decrement_variant_stock", { p_variant_id: l.variant_id });
        } else if (l.product_id) {
          await admin.rpc("decrement_product_stock", { p_product_id: l.product_id });
        }
      } catch (e) {
        console.error("[cart-fulfillment] stock decrement failed", l.variant_id ?? l.product_id, e);
      }
    }
  }

  // Itemized buyer receipt — best-effort.
  try {
    const { sendEmail } = await import("@/lib/email");
    const { SHELL } = await import("@/lib/emails/layout");
    const rows = lines
      .map(
        (l) =>
          `<tr><td style="padding:4px 0">${l.name_snapshot} × ${l.quantity}</td><td style="padding:4px 0;text-align:right">${formatINR(Math.round(Number(l.line_amount) * 100))}</td></tr>`,
      )
      .join("");
    const total = lines.reduce((a, l) => a + Number(l.line_amount), 0);
    const hi = order.buyer_name ? `Hi ${order.buyer_name},` : "Hi,";
    await sendEmail({
      to: order.buyer_email,
      role: "billing",
      sellerId: order.seller_user_id,
      subject: "Your order is confirmed",
      html: SHELL(
        `<h2 style="margin:0 0 12px;font-size:20px">Order confirmed ✅</h2>
         <p>${hi}</p>
         <p>Thanks for your purchase. Here's what you ordered:</p>
         <table style="width:100%;border-collapse:collapse;margin:12px 0">${rows}
           <tr><td style="padding:8px 0;border-top:1px solid #eee;font-weight:600">Total</td>
           <td style="padding:8px 0;border-top:1px solid #eee;text-align:right;font-weight:600">${formatINR(Math.round(total * 100))}</td></tr>
         </table>`,
        { preheader: "Your order is confirmed" },
      ),
    });
  } catch (e) {
    console.error("[cart-fulfillment] receipt email failed", e);
  }

  // Digital downloads — grant + email links for any digital products in the
  // cart (idempotent per order+product). Best-effort.
  try {
    const productIds = lines.map((l) => l.product_id).filter((id): id is string => !!id);
    if (productIds.length > 0) {
      const { grantDigitalDownloads } = await import("@/lib/downloads");
      await grantDigitalDownloads(
        {
          orderId: order.id,
          sellerUserId: order.seller_user_id,
          buyerEmail: order.buyer_email,
          productIds,
        },
        admin,
      );
    }
  } catch (e) {
    console.error("[cart-fulfillment] digital download grant failed", e);
  }

  // Settle coupon usage in Postgres (exactly-once — the caller already won the
  // pending→paid transition before calling this). Best-effort.
  try {
    const { data: ord } = await admin
      .from("orders")
      .select("coupon_id")
      .eq("id", order.id)
      .single();
    if (ord?.coupon_id) {
      const { settleCoupon } = await import("@/lib/coupons");
      await settleCoupon(ord.coupon_id);
    }
  } catch (e) {
    console.error("[cart-fulfillment] coupon settle failed", e);
  }

  // Invoice (background) — the generator summarizes the line items into the
  // invoice line and falls back gracefully if the seller has no GST profile.
  try {
    const { enqueueInvoiceJob } = await import("@/lib/queues/invoices");
    void enqueueInvoiceJob(order.id);
  } catch (e) {
    console.error("[cart-fulfillment] invoice enqueue failed", e);
  }
}
