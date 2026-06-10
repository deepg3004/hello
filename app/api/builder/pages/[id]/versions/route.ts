// GET /api/builder/pages/[id]/versions — list saved versions (newest first) for
// the seller's own page. Returns only ids + timestamps (the document is fetched
// per-version on restore). Owner-scoped.

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("builder_page_versions")
    .select("id, created_at")
    .eq("page_id", params.id)
    .eq("user_id", user.id) // ownership guard
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ versions: data ?? [] });
}
