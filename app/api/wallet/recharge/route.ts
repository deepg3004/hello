// POST /api/wallet/recharge
//
// Creates a Razorpay order (on InvoxAI's OWN platform gateway) for a wallet
// top-up. The client opens Razorpay Checkout with the returned order_id; on
// success it calls /api/wallet/verify-recharge which credits the wallet.

import { NextResponse } from "next/server";

import { requireActor } from "@/lib/account-context";
import { createOrder } from "@/lib/razorpay";
import { RECHARGE_AMOUNTS_PAISE } from "@/lib/wallet";

export async function POST(request: Request) {
  // The wallet belongs to the ACCOUNT OWNER. Resolve the effective owner and
  // require wallet.manage so a team member (e.g. a manager with wallet view-only)
  // can't recharge — which would otherwise credit the WRONG ledger.
  const actor = await requireActor("wallet.manage");
  if (!actor.ok) {
    return NextResponse.json({ error: actor.error }, { status: 403 });
  }
  const ownerId = actor.ctx.ownerId;

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
      receipt: `wallet_${ownerId.slice(0, 8)}_${amount_paise}`,
      notes: { purpose: "wallet_recharge", seller_id: ownerId },
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
