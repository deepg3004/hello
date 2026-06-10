// POST /api/tracking/event — Phase 15 first-party event beacon. Records a
// page view / event into the (enriched) storefront_events table and maintains
// an anonymous visitor_id + session_id cookie. Public + rate-limited. Stores
// NO raw PII: visitor/session ids are random opaque tokens, IP is never stored
// here (only used for the rate-limit key).

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  VISITOR_COOKIE,
  VISITOR_TTL_SECONDS,
  browserFromUA,
  deviceFromUA,
  newTrackingId,
} from "@/lib/tracking/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clip = (s: unknown, n: number) =>
  typeof s === "string" && s.trim() ? s.trim().slice(0, n) : null;
const uuidOrNull = (s: unknown) =>
  typeof s === "string" && UUID_RE.test(s) ? s : null;

interface Body {
  seller_id?: string;
  event_name?: string;
  page_type?: string;
  path?: string;
  source?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  order_id?: string;
  product_id?: string;
  event_value?: number | string;
  currency?: string;
  meta?: Record<string, unknown>;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.seller_id || !UUID_RE.test(body.seller_id)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`trkevt:${ip}`, 240, 60); // 240/min/IP
  if (!rl.ok) return NextResponse.json({ ok: true, throttled: true });

  // Resolve / mint the anonymous identifiers.
  const cookieHeader = request.headers.get("cookie") ?? "";
  const readCookie = (name: string) =>
    cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null;

  const visitorId = readCookie(VISITOR_COOKIE) || newTrackingId();
  const sessionId = readCookie(SESSION_COOKIE) || newTrackingId();

  const ua = request.headers.get("user-agent");
  const value =
    body.event_value != null && Number.isFinite(Number(body.event_value))
      ? Number(body.event_value)
      : null;

  const admin = createAdminClient();
  await admin.from("storefront_events").insert({
    seller_user_id: body.seller_id,
    type: "pageview",
    event_name: clip(body.event_name, 60) ?? "PageView",
    page_type: clip(body.page_type, 30),
    path: clip(body.path, 300),
    source: clip(body.source, 300),
    referrer: clip(body.referrer, 300),
    utm_source: clip(body.utm_source, 120),
    utm_medium: clip(body.utm_medium, 120),
    utm_campaign: clip(body.utm_campaign, 120),
    utm_content: clip(body.utm_content, 120),
    utm_term: clip(body.utm_term, 120),
    device_type: deviceFromUA(ua),
    browser: browserFromUA(ua),
    order_id: uuidOrNull(body.order_id),
    product_id: uuidOrNull(body.product_id),
    event_value: value,
    currency: clip(body.currency, 8),
    visitor_id: visitorId,
    session_id: sessionId,
    meta: body.meta && typeof body.meta === "object" ? body.meta : {},
  });

  const res = NextResponse.json({ ok: true, visitor_id: visitorId, session_id: sessionId });
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: false, // readable by the client tracker; it's an opaque id, not PII
    sameSite: "lax",
    secure,
    maxAge: VISITOR_TTL_SECONDS,
    path: "/",
  });
  res.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: false,
    sameSite: "lax",
    secure,
    maxAge: SESSION_TTL_SECONDS, // refreshed on every event → 30-min idle window
    path: "/",
  });
  return res;
}
