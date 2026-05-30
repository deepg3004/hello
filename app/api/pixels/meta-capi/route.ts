// POST /api/pixels/meta-capi
//
// Server-side fire of a Meta Conversions API event. We accept either:
//   - { order_id }          — best for purchase events; we look up the row
//   - { page_id, lead_id }  — for Lead events from /api/lead-captures
//
// Auth: callable only from our own server. We gate on a shared secret
// (CRON_SECRET) so external callers can't forge purchase events. Internal
// calls from verify-payment send the same header.
//
// The endpoint hashes buyer email + phone with SHA-256 (Meta's standard) so
// the seller's CAPI token + buyer PII never round-trip in cleartext.

import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { makeMetaEventId } from "@/lib/pixel-events";

const CAPI_VERSION = "v18.0";

interface Body {
  order_id?: string;
  page_id?: string;
  lead_id?: string;
  event_name?: "Purchase" | "Lead";
  /** Optional extras override what we pull from the row. */
  email?: string;
  phone?: string;
  value?: number;
  currency?: string;
}

function isAuthorised(request: Request): boolean {
  const want = process.env.CRON_SECRET;
  if (!want) return process.env.NODE_ENV !== "production"; // dev convenience
  return request.headers.get("x-cron-secret") === want;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalisePhone(input: string | null | undefined): string {
  return (input ?? "").replace(/[^0-9]/g, "");
}

export async function POST(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  let pixelId: string | null = null;
  let accessToken: string | null = null;
  let eventTime = Math.floor(Date.now() / 1000);
  let value = body.value ?? 0;
  let currency = body.currency ?? "INR";
  let email = body.email ?? null;
  let phone = body.phone ?? null;
  let eventId: string | null = null;
  let eventName: "Purchase" | "Lead" =
    body.event_name ?? (body.order_id ? "Purchase" : "Lead");

  if (body.order_id) {
    const { data: order } = await admin
      .from("orders")
      .select(
        "id, page_id, amount, currency, buyer_email, buyer_phone, paid_at",
      )
      .eq("id", body.order_id)
      .single();
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const { data: pixel } = await admin
      .from("pixel_configs")
      .select("meta_pixel_id, meta_capi_access_token, meta_fire_purchase")
      .eq("page_id", order.page_id ?? "")
      .maybeSingle();
    if (!pixel?.meta_pixel_id || !pixel.meta_capi_access_token) {
      return NextResponse.json({ ok: true, skipped: "no_capi_config" });
    }
    if (pixel.meta_fire_purchase === false) {
      return NextResponse.json({ ok: true, skipped: "disabled" });
    }
    pixelId = pixel.meta_pixel_id;
    accessToken = pixel.meta_capi_access_token;
    if (order.paid_at) eventTime = Math.floor(Date.parse(order.paid_at) / 1000);
    value = body.value ?? Number(order.amount ?? 0);
    currency = body.currency ?? (order.currency ?? "INR");
    email = body.email ?? order.buyer_email ?? null;
    phone = body.phone ?? order.buyer_phone ?? null;
    eventId = makeMetaEventId("purchase", order.id);
  } else if (body.page_id) {
    const { data: pixel } = await admin
      .from("pixel_configs")
      .select("meta_pixel_id, meta_capi_access_token, meta_fire_lead")
      .eq("page_id", body.page_id)
      .maybeSingle();
    if (!pixel?.meta_pixel_id || !pixel.meta_capi_access_token) {
      return NextResponse.json({ ok: true, skipped: "no_capi_config" });
    }
    if (pixel.meta_fire_lead === false) {
      return NextResponse.json({ ok: true, skipped: "disabled" });
    }
    pixelId = pixel.meta_pixel_id;
    accessToken = pixel.meta_capi_access_token;
    if (body.lead_id) eventId = makeMetaEventId("lead", body.lead_id);
    eventName = "Lead";
  } else {
    return NextResponse.json(
      { error: "order_id or page_id required" },
      { status: 400 },
    );
  }

  if (!pixelId || !accessToken) {
    return NextResponse.json({ ok: true, skipped: "no_capi_config" });
  }

  const userData: Record<string, string> = {};
  if (email) userData.em = sha256(email.trim().toLowerCase());
  const normPhone = normalisePhone(phone);
  if (normPhone) userData.ph = sha256(normPhone);
  // Client IP + UA help Meta dedupe against the browser fire.
  const ip = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  if (ip) userData.client_ip_address = ip;
  const ua = request.headers.get("user-agent");
  if (ua) userData.client_user_agent = ua;

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        event_id: eventId ?? undefined,
        action_source: "website",
        user_data: userData,
        custom_data:
          value > 0
            ? { value, currency, ...(eventName === "Purchase" ? { content_type: "product" } : {}) }
            : { currency },
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${CAPI_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(
        accessToken,
      )}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      console.error("[meta-capi] non-2xx", res.status, out);
      return NextResponse.json(
        { ok: false, error: `Meta HTTP ${res.status}`, meta: out },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, meta: out, event_id: eventId });
  } catch (e) {
    console.error("[meta-capi] fetch failed", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
