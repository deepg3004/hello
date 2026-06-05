// POST /api/checkout/validate-cart-coupon
//
// Read-only preview of a promo code against a multi-item cart, so the buyer can
// see the discount before paying. Resolves the seller + authoritative subtotal
// via validateCart (same path create-cart-order uses), then validates the
// coupon against that seller. Does NOT reserve a slot — reservation happens at
// order creation.

import { NextResponse } from "next/server";

import { validateCart, type CartItemInput } from "@/lib/cart";
import { validateCartCoupon } from "@/lib/coupons";

export async function POST(request: Request) {
  let body: { items?: CartItemInput[]; code?: string; buyer_email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = body.code?.trim();
  if (!code) return NextResponse.json({ error: "Enter a promo code" }, { status: 400 });

  const v = await validateCart(body.items ?? []);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const cv = await validateCartCoupon({
    code,
    seller_id: v.cart.sellerId,
    amount: v.cart.subtotalPaise / 100,
    buyer_email: body.buyer_email?.trim().toLowerCase() || undefined,
  });
  if (!cv.valid) return NextResponse.json({ error: cv.reason }, { status: 400 });

  return NextResponse.json({
    ok: true,
    code: cv.code,
    discount_amount: cv.discount_amount,
  });
}
