// GET /api/builder/pages/[id]/versions/[vid] — return one version's document so
// the editor can load it for restore. Owner-scoped.

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string; vid: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("builder_page_versions")
    .select("content_json")
    .eq("id", params.vid)
    .eq("page_id", params.id)
    .eq("user_id", user.id) // ownership guard
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ content_json: data.content_json });
}
