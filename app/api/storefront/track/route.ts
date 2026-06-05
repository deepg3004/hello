// POST /api/storefront/track — public beacon that records a storefront page
// view + its click source. Fired by StorefrontTracker on page load. Rate-limited
// per IP to keep the table from being spammed.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: { seller_id?: string; path?: string; source?: string; referrer?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.seller_id || !UUID_RE.test(body.seller_id)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`sfevt:${ip}`, 120, 60); // 120/min/IP
  if (!rl.ok) return NextResponse.json({ ok: true, throttled: true });

  const clip = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : null);

  const admin = createAdminClient();
  await admin.from("storefront_events").insert({
    seller_user_id: body.seller_id,
    type: "pageview",
    path: clip(body.path, 300),
    source: clip(body.source, 300),
    referrer: clip(body.referrer, 300),
  });

  return NextResponse.json({ ok: true });
}
