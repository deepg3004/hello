// POST /api/wallet/verify-recharge
//
// Verifies the Razorpay payment signature for a wallet top-up and credits the
// seller's wallet via the atomic credit_wallet_balance() RPC (migration 040).

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPayment } from "@/lib/razorpay";
import { RECHARGE_AMOUNTS_PAISE } from "@/lib/wallet";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    amount_paise?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    amount_paise,
  } = body;

  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature ||
    !amount_paise
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  // Re-validate the amount server-side — never trust the client's number.
  if (!RECHARGE_AMOUNTS_PAISE.includes(amount_paise)) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  if (
    !verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature })
  ) {
    return NextResponse.json({ error: "Signature mismatch" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: newBalance, error } = await admin.rpc("credit_wallet_balance", {
    p_seller_id: user.id,
    p_amount_paise: amount_paise,
    p_description: `Wallet recharge — ₹${amount_paise / 100}`,
  });

  if (error) {
    console.error("[wallet/verify-recharge] credit failed", error);
    return NextResponse.json(
      { error: "Payment captured but wallet credit failed — contact support." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    credited_paise: amount_paise,
    balance_paise: newBalance ?? null,
  });
}
