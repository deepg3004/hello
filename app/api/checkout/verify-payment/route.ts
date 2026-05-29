// POST /api/checkout/verify-payment
//
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id }
//
// Validates the in-checkout signature, marks the order paid, writes ledger
// rows, marks the abandoned_checkout as recovered, rolls up totals on
// pages and user_profiles, and triggers post-purchase work.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPayment } from "@/lib/razorpay";
import { settleCoupon } from "@/lib/coupons";

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
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  if (!verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    return NextResponse.json({ error: "Signature mismatch" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, page_id, seller_user_id, product_id, amount, platform_commission, seller_amount, currency, coupon_id, status, buyer_email, buyer_name",
    )
    .eq("id", order_id)
    .single();
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "paid") {
    // Idempotent — already marked.
    return NextResponse.json({
      ok: true,
      order_id,
      redirect_url: redirectUrl(order_id, order.page_id),
      already_paid: true,
    });
  }

  // 1. Mark order paid
  const paidAt = new Date().toISOString();
  await admin
    .from("orders")
    .update({
      status: "paid",
      gateway_payment_id: razorpay_payment_id,
      gateway_signature: razorpay_signature,
      paid_at: paidAt,
    })
    .eq("id", order_id);

  // 2. Ledger: sale (seller credit) + commission (platform credit)
  await admin.from("transactions").insert([
    {
      user_id: order.seller_user_id,
      order_id,
      type: "sale",
      amount: Number(order.seller_amount),
      status: "completed",
      reference_id: razorpay_payment_id,
      notes: `Sale ${razorpay_order_id}`,
    },
    {
      user_id: order.seller_user_id,
      order_id,
      type: "commission",
      amount: -Number(order.platform_commission),
      status: "completed",
      reference_id: razorpay_payment_id,
      notes: `Platform commission ${razorpay_order_id}`,
    },
  ]);

  // 3. Abandoned checkout → recovered
  await admin
    .from("abandoned_checkouts")
    .update({ status: "recovered", recovered_at: paidAt })
    .eq("buyer_email", order.buyer_email)
    .eq("page_id", order.page_id)
    .eq("status", "active");

  // 4. Roll up totals — read, increment, write (no SQL fn here)
  if (order.page_id) {
    const { data: page } = await admin
      .from("pages")
      .select("total_revenue, conversion_count")
      .eq("id", order.page_id)
      .single();
    if (page) {
      await admin
        .from("pages")
        .update({
          total_revenue:
            Number(page.total_revenue ?? 0) + Number(order.amount ?? 0),
          conversion_count: Number(page.conversion_count ?? 0) + 1,
        })
        .eq("id", order.page_id);
    }
  }
  {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("total_revenue")
      .eq("id", order.seller_user_id)
      .single();
    if (profile) {
      await admin
        .from("user_profiles")
        .update({
          total_revenue:
            Number(profile.total_revenue ?? 0) + Number(order.amount ?? 0),
        })
        .eq("id", order.seller_user_id);
    }
  }

  // 5. Settle coupon usage_count in Postgres
  if (order.coupon_id) {
    try {
      await settleCoupon(order.coupon_id);
    } catch (e) {
      console.error("settleCoupon failed", e);
    }
  }

  // 6. Post-purchase: if the page has a Telegram VIP group attached, mint a
  //    one-time invite + membership row. Best-effort — bot/group failures
  //    surface on the thank-you page but don't block checkout.
  try {
    const { issueInviteForOrder } = await import("@/actions/telegram");
    const inviteResult = await issueInviteForOrder(order_id);
    if (inviteResult.ok && "invite_link" in inviteResult) {
      const { inviteEmail, sendEmail } = await import("@/lib/email");
      const { data: page } = await admin
        .from("pages")
        .select("telegram_group_id, telegram_vip_groups(group_name)")
        .eq("id", order.page_id ?? "")
        .single();
      type Joined = { group_name: string | null };
      const groupRel = (page as unknown as { telegram_vip_groups: Joined | Joined[] | null } | null)?.telegram_vip_groups;
      const groupName = (Array.isArray(groupRel) ? groupRel[0]?.group_name : groupRel?.group_name) ?? undefined;
      const tpl = inviteEmail({
        buyerName: order.buyer_name ?? undefined,
        groupName,
        inviteLink: inviteResult.invite_link,
      });
      await sendEmail({
        to: order.buyer_email,
        subject: tpl.subject,
        html: tpl.html,
      });
    }
  } catch (e) {
    console.error("[verify-payment] telegram invite failed", e);
  }

  return NextResponse.json({
    ok: true,
    success: true,
    order_id,
    redirect_url: redirectUrl(order_id, order.page_id),
  });
}

function redirectUrl(orderId: string, _pageId: string | null): string {
  // Lands on the public order confirmation page.
  return `/order/${orderId}?status=success`;
}
