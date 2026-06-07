// GET /api/coupons/available?page_id=<page_id>
//
// Public list of promo codes the seller opted to surface at checkout
// (show_at_checkout = true) that apply to this page (all-page coupons or ones
// whose page_ids include it). Read-only; the apply step (/api/coupons/validate)
// re-validates fully.

import { NextResponse } from "next/server";

import { listAvailableCoupons } from "@/lib/coupons";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const page_id = new URL(request.url).searchParams.get("page_id");
  if (!page_id) return NextResponse.json({ coupons: [] });

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select("user_id, status")
    .eq("id", page_id)
    .single();
  if (!page || page.status !== "published") {
    return NextResponse.json({ coupons: [] });
  }

  const coupons = await listAvailableCoupons({
    seller_id: page.user_id as string,
    page_id,
  });
  return NextResponse.json({ coupons });
}
