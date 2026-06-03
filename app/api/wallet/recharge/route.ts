// POST /api/wallet/recharge
//
// Creates a Razorpay order (on InvoxAI's OWN platform gateway) for a wallet
// top-up. The client opens Razorpay Checkout with the returned order_id; on
// success it calls /api/wallet/verify-recharge which credits the wallet.

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createOrder } from "@/lib/razorpay";
import { RECHARGE_AMOUNTS_PAISE } from "@/lib/wallet";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { amount_paise?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amount_paise = body.amount_paise;
  if (!amount_paise || !RECHARGE_AMOUNTS_PAISE.includes(amount_paise)) {
    return NextResponse.json(
      { error: "Invalid recharge amount" },
      { status: 400 },
    );
  }

  try {
    const order = await createOrder({
      amount: amount_paise,
      currency: "INR",
      receipt: `wallet_${user.id.slice(0, 8)}_${amount_paise}`,
      notes: { purpose: "wallet_recharge", seller_id: user.id },
    });

    return NextResponse.json({
      razorpay_order_id: order.id,
      amount: amount_paise,
      currency: "INR",
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (e) {
    console.error("[wallet/recharge] order create failed", e);
    return NextResponse.json(
      { error: "Could not start recharge" },
      { status: 500 },
    );
  }
}
