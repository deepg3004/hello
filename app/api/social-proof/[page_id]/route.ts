// GET /api/social-proof/[page_id]
// Returns up to 10 recent social proof events for the page.
//
// Anyone can call this — events are intentionally meant for public display
// on the live page widget. RLS on social_proof_events allows public read for
// published pages already.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface ProofRow {
  buyer_name: string | null;
  buyer_city: string | null;
  product_name: string | null;
  amount: number | null;
  is_seed: boolean | null;
  created_at: string;
}

export async function GET(
  _request: Request,
  { params }: { params: { page_id: string } },
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("social_proof_events")
    .select("buyer_name, buyer_city, product_name, amount, is_seed, created_at")
    .eq("page_id", params.page_id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ events: [], error: error.message }, { status: 500 });
  }
  return NextResponse.json({ events: (data ?? []) as ProofRow[] });
}
