// POST /api/builder/sites/apply  { templateId }
// One-click apply: copies a code-defined template's page document + header +
// footer + bottom-bar + background into the seller's site as a NEW page, and
// returns its id so the client opens it in the editor. Owner-scoped.

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { templateById } from "@/lib/builder/templates";

export const dynamic = "force-dynamic";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "page";
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { templateId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const tpl = body.templateId ? templateById(body.templateId) : undefined;
  if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const admin = createAdminClient();

  // Find or create the seller's site.
  let { data: site } = await admin.from("builder_sites").select("id").eq("user_id", user.id).maybeSingle();
  if (!site) {
    const { data: prof } = await admin.from("user_profiles").select("subdomain").eq("id", user.id).maybeSingle();
    let slug = (prof?.subdomain as string | null) || `u-${user.id.slice(0, 8)}`;
    for (let i = 0; i < 5; i++) {
      const { data: clash } = await admin.from("builder_sites").select("id").eq("slug", slug).maybeSingle();
      if (!clash) break;
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }
    const { data: created, error } = await admin
      .from("builder_sites")
      .insert({ user_id: user.id, slug, title: "My site" })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    site = created;
  }

  // Apply the GLOBAL header + footer from the template (full design).
  await admin
    .from("builder_sites")
    .update({ header_json: tpl.header, footer_json: tpl.footer, updated_at: new Date().toISOString() })
    .eq("id", site.id);

  // Create a NEW page from the template (unique path so it never clobbers home).
  const path = `${slugify(tpl.name)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data: page, error: pErr } = await admin
    .from("builder_pages")
    .insert({
      site_id: site.id,
      user_id: user.id,
      name: tpl.name,
      path,
      page_type: tpl.page_type,
      content_json: tpl.document,
      background_style: tpl.background_style,
      bottombar_json: tpl.bottombar,
    })
    .select("id")
    .single();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, pageId: page.id });
}
