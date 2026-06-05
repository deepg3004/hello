// POST /api/checkout/verify-cart-payment
//
// Confirms a multi-item cart order (Store Phase 2b). Separate from the
// single-item verify-payment so the live path is untouched. Verifies the
// seller-gateway signature, finalizes the order exactly-once, decrements stock
// per line item, charges the platform wallet fee once, and emails a receipt.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaymentWithSecret } from "@/lib/razorpay";
import { loadSellerGatewayKeys } from "@/lib/gateway-loader";
import { chargePlatformWalletFee } from "@/lib/order-fulfillment";
import { formatINR } from "@/lib/utils";

export async function POST(request: Request) {
  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    order_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, status, seller_user_id, buyer_email, buyer_name, source, gateway_owner")
    .eq("id", order_id)
    .single();
  if (!order || order.source !== "cart") {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status === "paid") {
    return NextResponse.json({ ok: true, order_id, redirect_url: `/order/${order_id}`, already_paid: true });
  }

  // Verify the signature with the seller's own gateway secret.
  const keys = await loadSellerGatewayKeys(order.seller_user_id);
  const valid = keys
    ? verifyPaymentWithSecret(
        { razorpay_order_id, razorpay_payment_id, razorpay_signature },
        keys.key_secret,
      )
    : false;
  if (!valid) {
    return NextResponse.json({ error: "Signature mismatch" }, { status: 401 });
  }

  // Atomic pending→paid so every side-effect runs exactly once.
  const { data: paidRows } = await admin
    .from("orders")
    .update({
      status: "paid",
      gateway_payment_id: razorpay_payment_id,
      gateway_signature: razorpay_signature,
      paid_at: new Date().toISOString(),
    })
    .eq("id", order_id)
    .eq("status", "pending")
    .select("id");
  if (!paidRows || paidRows.length === 0) {
    return NextResponse.json({ ok: true, order_id, redirect_url: `/order/${order_id}`, already_paid: true });
  }

  // Load line items for stock + receipt.
  const { data: items } = await admin
    .from("order_items")
    .select("product_id, name_snapshot, unit_price, quantity, line_amount")
    .eq("order_id", order_id);
  const lines = (items ?? []) as Array<{
    product_id: string | null;
    name_snapshot: string;
    unit_price: number;
    quantity: number;
    line_amount: number;
  }>;

  // Decrement stock per line (the RPC subtracts 1; call it `quantity` times).
  for (const l of lines) {
    if (!l.product_id) continue;
    for (let i = 0; i < l.quantity; i++) {
      try {
        await admin.rpc("decrement_product_stock", { p_product_id: l.product_id });
      } catch (e) {
        console.error("[verify-cart] stock decrement failed", l.product_id, e);
        break;
      }
    }
  }

  // Platform wallet fee — once per order (idempotent at the RPC layer).
  try {
    await chargePlatformWalletFee({ sellerUserId: order.seller_user_id, orderId: order_id }, admin);
  } catch (e) {
    console.error("[verify-cart] wallet fee failed", e);
  }

  // Best-effort receipt email listing the items.
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
    console.error("[verify-cart] receipt email failed", e);
  }

  return NextResponse.json({ ok: true, order_id, redirect_url: `/order/${order_id}` });
}
