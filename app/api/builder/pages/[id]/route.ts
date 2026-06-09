// PUT /api/builder/pages/[id] — save a page's editor document (content_json) and
// optional page-level settings. Owner-scoped: the update is constrained to the
// signed-in user's own pages.

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    content_json?: unknown;
    name?: string;
    page_type?: "payment" | "landing" | "leads";
    background_style?: string;
    bottombar_json?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.content_json !== undefined) patch.content_json = body.content_json;
  if (typeof body.name === "string") patch.name = body.name.trim() || "Untitled";
  if (body.page_type && ["payment", "landing", "leads"].includes(body.page_type))
    patch.page_type = body.page_type;
  if (typeof body.background_style === "string") patch.background_style = body.background_style;
  if (body.bottombar_json !== undefined) patch.bottombar_json = body.bottombar_json;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("builder_pages")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", user.id) // ownership guard
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
