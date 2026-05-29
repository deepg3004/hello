// GET /api/coupons/validate?code=XXX&page_id=YYY&amount=ZZZ&buyer_email=...
//
// Read-only check. Returns either:
//   { valid: true,  coupon_id, code, discount_type, discount_value, discount_amount }
//   { valid: false, reason: "..." }
//
// Does NOT reserve a slot — that happens in /api/checkout/create-order.

import { NextResponse } from "next/server";

import { validateCoupon } from "@/lib/coupons";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const page_id = url.searchParams.get("page_id");
  const amountParam = url.searchParams.get("amount");
  const buyer_email = url.searchParams.get("buyer_email") ?? undefined;

  if (!code || !page_id) {
    return NextResponse.json(
      { valid: false, reason: "code and page_id are required" },
      { status: 400 },
    );
  }

  // If amount wasn't supplied, fall back to the product price on the page.
  let amount = amountParam ? Number(amountParam) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    const admin = createAdminClient();
    const { data: page } = await admin
      .from("pages")
      .select("id, products(price)")
      .eq("id", page_id)
      .single();
    const products = (page as unknown as { products?: Array<{ price: number }> } | null)?.products;
    amount = Number(products?.[0]?.price ?? 0);
  }

  const result = await validateCoupon({ code, page_id, amount, buyer_email });
  return NextResponse.json(result, { status: result.valid ? 200 : 400 });
}
