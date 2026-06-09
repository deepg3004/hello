// PUT /api/builder/sites/me/header — save the seller's GLOBAL header document.
// Owner-scoped. The header is a BuilderDocument shown on every published page.

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { header_json?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("builder_sites")
    .update({ header_json: body.header_json ?? null, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No site" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
