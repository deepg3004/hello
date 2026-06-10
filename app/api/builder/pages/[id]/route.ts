// Builder page operations, all owner-scoped to the signed-in user's own pages:
//   PUT    — save the editor document (content_json) + page-level settings + SEO
//   POST   — duplicate the page (returns the new page's id)
//   DELETE — delete the page

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
    seo_title?: string;
    seo_description?: string;
    og_image?: string;
    noindex?: boolean;
    access_password?: string;
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
  // SEO (migration 089) — an empty string clears the field.
  if (typeof body.seo_title === "string") patch.seo_title = body.seo_title.trim().slice(0, 200) || null;
  if (typeof body.seo_description === "string")
    patch.seo_description = body.seo_description.trim().slice(0, 400) || null;
  if (typeof body.og_image === "string") patch.og_image = body.og_image.trim().slice(0, 1000) || null;
  if (typeof body.noindex === "boolean") patch.noindex = body.noindex;
  // Password gate (migration 092) — empty string clears the lock.
  if (typeof body.access_password === "string") patch.access_password = body.access_password.trim().slice(0, 200) || null;

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

  // Snapshot the saved document into version history (best-effort — never block
  // the save). Capped to the latest 20 per page (migration 091).
  if (body.content_json !== undefined) {
    void (async () => {
      try {
        await admin.from("builder_page_versions").insert({
          page_id: params.id,
          user_id: user.id,
          content_json: body.content_json,
        });
        const { data: old } = await admin
          .from("builder_page_versions")
          .select("id")
          .eq("page_id", params.id)
          .order("created_at", { ascending: false })
          .range(20, 200);
        const ids = (old ?? []).map((r) => r.id as string);
        if (ids.length) await admin.from("builder_page_versions").delete().in("id", ids);
      } catch {
        /* version history is best-effort */
      }
    })();
  }

  return NextResponse.json({ ok: true });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  // Load the source page (ownership-scoped).
  const { data: src } = await admin
    .from("builder_pages")
    .select(
      "site_id, name, page_type, content_json, background_style, bottombar_json, seo_title, seo_description, og_image, noindex, sort_order",
    )
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!src) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const base = `${(src.name as string) || "page"} copy`.slice(0, 120);
  // A unique path so the copy never collides with the original (path is the URL).
  const path = `${(src.name as string) || "page"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 36)
    .concat(`-${Math.random().toString(36).slice(2, 6)}`);

  const { data: created, error } = await admin
    .from("builder_pages")
    .insert({
      site_id: src.site_id,
      user_id: user.id,
      name: base,
      path,
      page_type: src.page_type,
      content_json: src.content_json,
      background_style: src.background_style,
      bottombar_json: src.bottombar_json,
      seo_title: src.seo_title,
      seo_description: src.seo_description,
      og_image: src.og_image,
      noindex: src.noindex,
      sort_order: (Number(src.sort_order) || 0) + 1,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, pageId: created.id });
}

export async function DELETE(
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
    .from("builder_pages")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
