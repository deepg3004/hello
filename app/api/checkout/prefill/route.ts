// GET /api/checkout/prefill?token=<recovery_token>
//
// Looks up an abandoned_checkouts row by token and returns the minimal
// data the public checkout form needs to pre-populate fields. Returns
// 401 when the token is missing, expired, or the row is no longer active.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

interface Row {
  id: string;
  page_id: string | null;
  buyer_email: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  status: string;
  token_expires_at: string | null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("abandoned_checkouts")
    .select(
      "id, page_id, buyer_email, buyer_name, buyer_phone, status, token_expires_at",
    )
    .eq("recovery_token", token)
    .single<Row>();
  if (!data) {
    return NextResponse.json({ error: "Token invalid" }, { status: 401 });
  }
  if (data.status === "expired") {
    return NextResponse.json({ error: "Token expired" }, { status: 401 });
  }
  if (
    data.token_expires_at &&
    new Date(data.token_expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json({ error: "Token expired" }, { status: 401 });
  }
  if (data.status === "recovered") {
    // Already converted — tell the client to drop the prefill silently.
    return NextResponse.json({ error: "Already recovered" }, { status: 410 });
  }

  return NextResponse.json({
    ok: true,
    page_id: data.page_id,
    buyer_email: data.buyer_email,
    buyer_name: data.buyer_name,
    buyer_phone: data.buyer_phone,
  });
}
