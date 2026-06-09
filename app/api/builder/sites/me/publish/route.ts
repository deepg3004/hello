// POST /api/builder/sites/me/publish — make the seller's builder site public at
// /u/<slug>. Owner-scoped. (POST sets published; pass { unpublish: true } to hide.)

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let unpublish = false;
  try {
    const body = (await request.json()) as { unpublish?: boolean };
    unpublish = !!body.unpublish;
  } catch {
    /* no body → publish */
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("builder_sites")
    .update({ is_published: !unpublish, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select("slug")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No site" }, { status: 404 });

  return NextResponse.json({ ok: true, published: !unpublish, slug: data.slug });
}
