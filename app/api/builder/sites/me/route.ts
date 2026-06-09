// GET /api/builder/sites/me — return the signed-in seller's builder site + its
// pages, bootstrapping a default site + Home page on first use so the editor
// always has something to open. Owner-scoped (RLS + explicit user.id).

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emptyDocument } from "@/lib/builder/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Find or create the seller's site.
  let { data: site } = await admin
    .from("builder_sites")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!site) {
    // Prefer the seller's existing subdomain as the slug; else a stable fallback.
    const { data: prof } = await admin
      .from("user_profiles")
      .select("subdomain")
      .eq("id", user.id)
      .maybeSingle();
    const base = (prof?.subdomain as string | null) || `u-${user.id.slice(0, 8)}`;
    let slug = base;
    // Ensure uniqueness (slug is UNIQUE) with a short suffix if taken.
    for (let i = 0; i < 5; i++) {
      const { data: clash } = await admin
        .from("builder_sites")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!clash) break;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    const { data: created, error } = await admin
      .from("builder_sites")
      .insert({ user_id: user.id, slug, title: "My site" })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    site = created;
  }

  let { data: pages } = await admin
    .from("builder_pages")
    .select("*")
    .eq("site_id", site.id)
    .order("sort_order", { ascending: true });

  if (!pages || pages.length === 0) {
    const { data: page } = await admin
      .from("builder_pages")
      .insert({
        site_id: site.id,
        user_id: user.id,
        name: "Home",
        path: "",
        page_type: "landing",
        content_json: emptyDocument(),
      })
      .select("*")
      .single();
    pages = page ? [page] : [];
  }

  return NextResponse.json({ site, pages });
}

// PUT /api/builder/sites/me — update global styles, contacts, or title.
export async function PUT(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; global_styles_json?: unknown; contacts_json?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") patch.title = body.title.trim() || "My site";
  if (body.global_styles_json !== undefined) patch.global_styles_json = body.global_styles_json;
  if (body.contacts_json !== undefined) patch.contacts_json = body.contacts_json;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("builder_sites")
    .update(patch)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No site" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
