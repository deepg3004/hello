// GET /api/coupons/validate?code=XXX&page_id=YYY&amount=ZZZ&buyer_email=...
//
// Returns:
//   { valid: true,  coupon_id, code, discount_type, discount_value,
//     discount_amount, final_amount, message }
//   { valid: false, message }
//
// Read-only — DOES NOT decrement usage_count. The atomic decrement happens in
// /api/checkout/verify-payment via a SQL UPDATE...WHERE usage_count < limit so
// we never oversell.

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
      { valid: false, message: "code and page_id are required" },
      { status: 400 },
    );
  }

  // Resolve amount — fall back to the product's price when client didn't pass.
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

  // Per-customer limit — count completed (paid) orders by this email that
  // used this coupon. Cheaper than a redemption table for now.
  let perCustomerOk = true;
  let perCustomerLeft: number | null = null;
  if (buyer_email) {
    const admin = createAdminClient();
    const { data: coupon } = await admin
      .from("coupons")
      .select("id, per_customer_limit")
      .eq("code", code)
      .maybeSingle();
    if (coupon?.id) {
      const { count } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", coupon.id)
        .ilike("buyer_email", buyer_email)
        .eq("status", "paid");
      const used = count ?? 0;
      perCustomerLeft = Math.max(0, (coupon.per_customer_limit ?? 1) - used);
      perCustomerOk = perCustomerLeft > 0;
    }
  }

  if (!perCustomerOk) {
    return NextResponse.json(
      { valid: false, message: "You've already used this coupon." },
      { status: 400 },
    );
  }

  const result = await validateCoupon({ code, page_id, amount, buyer_email });
  if (!result.valid) {
    return NextResponse.json(
      { valid: false, message: result.reason },
      { status: 400 },
    );
  }

  const final_amount = Math.max(0, amount - result.discount_amount);
  return NextResponse.json({
    valid: true,
    coupon_id: result.coupon_id,
    code: result.code,
    discount_type: result.discount_type,
    discount_value: result.discount_value,
    discount_amount: result.discount_amount,
    final_amount,
    message: `Applied — you save ₹${result.discount_amount.toLocaleString("en-IN")}.`,
  });
}
