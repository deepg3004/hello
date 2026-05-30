// POST /api/affiliate/track-click
//
// Body: { slug, ref }
//
// Validates the referral code, sets the per-slug attribution cookie
// (30-day TTL), and increments affiliate_links.clicks.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  REF_COOKIE_TTL_DAYS,
  refCookieName,
} from "@/lib/affiliate";

export async function POST(request: Request) {
  let body: { slug?: string; ref?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const slug = body.slug?.trim();
  const ref = body.ref?.trim();
  if (!slug || !ref) {
    return NextResponse.json({ error: "slug + ref required" }, { status: 400 });
  }

  const admin = createAdminClient();
  // Validate that the ref code exists AND belongs to this page's program.
  const { data: link } = await admin
    .from("affiliate_links")
    .select(
      "id, status, affiliate_id, clicks, affiliates(page_id, status, pages(slug))",
    )
    .eq("referral_code", ref)
    .maybeSingle();
  if (!link || link.status !== "active") {
    return NextResponse.json({ ok: true, ignored: "invalid_ref" });
  }
  type Joined = {
    page_id: string;
    status: string;
    pages: { slug?: string | null } | { slug?: string | null }[] | null;
  };
  const programRel = (link as unknown as { affiliates: Joined | Joined[] | null })
    .affiliates;
  const program = Array.isArray(programRel) ? programRel[0] : programRel;
  if (!program || program.status !== "active") {
    return NextResponse.json({ ok: true, ignored: "program_inactive" });
  }
  const pagesRel = program.pages;
  const linkedPage = Array.isArray(pagesRel) ? pagesRel[0] : pagesRel;
  if (!linkedPage || linkedPage.slug !== slug) {
    // Code from a different page's program — drop it.
    return NextResponse.json({ ok: true, ignored: "wrong_page" });
  }

  // Increment click counter + last_active_at. Best-effort; OK if a parallel
  // request races us.
  await admin
    .from("affiliate_links")
    .update({
      clicks: Number(link.clicks ?? 0) + 1,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", link.id);

  // Set the cookie on the response so the same browser keeps the attribution
  // for 30 days.
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: refCookieName(slug),
    value: ref,
    maxAge: REF_COOKIE_TTL_DAYS * 86_400,
    path: "/",
    sameSite: "lax",
  });
  return response;
}
