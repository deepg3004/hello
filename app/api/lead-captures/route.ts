// POST /api/lead-captures
// Body: { page_id, name?, email, phone?, source?, utm? }
// Inserts a row into public.lead_captures via the admin client (RLS bypass).

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let body: {
    page_id?: string;
    name?: string;
    email?: string;
    phone?: string | null;
    source?: string | null;
    utm?: Record<string, string>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { page_id, name, email, phone, source, utm } = body;
  if (!page_id || !email) {
    return NextResponse.json(
      { error: "page_id and email are required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id, status")
    .eq("id", page_id)
    .single();
  if (!page || page.status !== "published") {
    return NextResponse.json({ error: "Page is not live" }, { status: 404 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { error } = await admin.from("lead_captures").insert({
    page_id,
    seller_user_id: page.user_id,
    name: name ?? null,
    email,
    phone: phone ?? null,
    source: source ?? null,
    utm: utm ?? null,
    ip_address: ip,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
