// GET /api/buyer/profile
//
// Returns the signed-in buyer's saved checkout details (name / email / phone)
// from their most-recent paid order, so checkout forms can auto-fill for a
// returning customer. Reads the `invoxai_buyer` session cookie (set when the
// buyer logs in at /account or via the returning-customer OTP at checkout).
//
// Always 200 — { ok: true, buyer } when recognised, { ok: false } otherwise —
// so the client can treat "not logged in" as a quiet no-op, never an error.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { BUYER_COOKIE, verifyBuyerSession } from "@/lib/buyer-portal";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = cookies().get(BUYER_COOKIE)?.value;
  const email = token ? verifyBuyerSession(token) : null;
  if (!email) return NextResponse.json({ ok: false });

  const admin = createAdminClient();
  // Most-recent paid order for this email gives the freshest name/phone the
  // buyer used. Scanned across all sellers — it's the buyer's own data.
  const { data } = await admin
    .from("orders")
    .select("buyer_name, buyer_email, buyer_phone")
    .eq("buyer_email", email)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    buyer: {
      name: data?.buyer_name ?? "",
      email: data?.buyer_email ?? email,
      phone: data?.buyer_phone ?? "",
    },
  });
}
