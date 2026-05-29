// GET /api/pages/check-slug?slug=XXX
// Returns { available: boolean }

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isValidSlug } from "@/lib/templates/utils";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const excludeId = url.searchParams.get("exclude_id");

  if (!slug) {
    return NextResponse.json({ available: false, reason: "Missing slug" });
  }
  if (!isValidSlug(slug)) {
    return NextResponse.json({ available: false, reason: "Invalid format" });
  }

  const admin = createAdminClient();
  let query = admin.from("pages").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (excludeId) query = query.neq("id", excludeId);
  const { count, error } = await query;

  if (error) {
    return NextResponse.json({ available: false, reason: error.message }, { status: 500 });
  }
  return NextResponse.json({ available: (count ?? 0) === 0 });
}
