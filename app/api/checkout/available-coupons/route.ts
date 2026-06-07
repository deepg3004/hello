// GET /api/checkout/available-coupons?seller=<seller_user_id>
//
// Public list of promo codes the seller opted to surface at checkout
// (show_at_checkout = true), filtered to currently-valid, non-page-restricted
// codes for whole-cart checkout. Returns only public data; the apply step
// (validate-cart-coupon) still re-validates fully.

import { NextResponse } from "next/server";

import { listAvailableCoupons } from "@/lib/coupons";

export async function GET(request: Request) {
  const seller = new URL(request.url).searchParams.get("seller");
  if (!seller) return NextResponse.json({ coupons: [] });
  const coupons = await listAvailableCoupons({ seller_id: seller });
  return NextResponse.json({ coupons });
}
