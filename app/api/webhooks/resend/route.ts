// POST /api/webhooks/resend
//
// Resend posts svix-signed events (delivered / opened / clicked / bounced).
// We use this primarily to count opens on the cart-recovery emails — match
// `data.email_id` against abandoned_checkouts.recovery_email{1,2}_message_id
// and bump email_opens / append to email_open_events.
//
// Configure: in Resend dashboard, point a webhook at
//   https://app.invoxai.io/api/webhooks/resend
// and put the signing secret in env var RESEND_WEBHOOK_SECRET.
//
// We accept events without a secret too (dev / staging where Resend isn't
// configured yet) — but in production the secret is required.

import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

interface ResendEvent {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    subject?: string;
    tags?: Record<string, string> | Array<{ name: string; value: string }>;
  };
}

function verifySvixSignature(
  raw: string,
  msgId: string | null,
  timestamp: string | null,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // Prod must always have the secret. Dev/staging can opt-in to accept
    // unsigned events for local testing only.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[resend-webhook] RESEND_WEBHOOK_SECRET missing in production",
      );
      return false;
    }
    return true;
  }
  if (!msgId || !timestamp || !signatureHeader) return false;

  // Svix signs `${msgId}.${timestamp}.${body}` with the base64 secret.
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(
      secret.replace(/^whsec_/, ""),
      "base64",
    );
  } catch {
    return false;
  }
  const signed = `${msgId}.${timestamp}.${raw}`;
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signed)
    .digest("base64");
  // Header is space-separated `v1,<sig> v1,<sig2>` — find any match.
  const candidates = signatureHeader
    .split(" ")
    .map((s) => s.split(",")[1])
    .filter(Boolean);
  return candidates.some((s) => {
    try {
      const a = Buffer.from(s, "base64");
      const b = Buffer.from(expected, "base64");
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const ok = verifySvixSignature(
    raw,
    request.headers.get("svix-id"),
    request.headers.get("svix-timestamp"),
    request.headers.get("svix-signature"),
  );
  if (!ok) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let body: ResendEvent;
  try {
    body = JSON.parse(raw) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const event = body.type;
  const emailId = body.data?.email_id;
  if (!emailId) {
    return NextResponse.json({ ok: true, ignored: "no email_id" });
  }

  const admin = createAdminClient();

  switch (event) {
    case "email.opened": {
      // Find which recovery email this was. Two queries are cheaper than a
      // join here and we want the row id for the append.
      const { data: row1 } = await admin
        .from("abandoned_checkouts")
        .select("id, email_opens, email_open_events")
        .eq("recovery_email1_message_id", emailId)
        .maybeSingle();
      const { data: row2 } = !row1
        ? await admin
            .from("abandoned_checkouts")
            .select("id, email_opens, email_open_events")
            .eq("recovery_email2_message_id", emailId)
            .maybeSingle()
        : { data: null };
      const target = row1 ?? row2;
      if (target) {
        const newEvents = Array.isArray(target.email_open_events)
          ? [
              ...(target.email_open_events as unknown[]),
              { at: new Date().toISOString(), email_id: emailId },
            ]
          : [{ at: new Date().toISOString(), email_id: emailId }];
        await admin
          .from("abandoned_checkouts")
          .update({
            email_opens: Number(target.email_opens ?? 0) + 1,
            email_open_events: newEvents,
          })
          .eq("id", target.id);
      }
      break;
    }
    case "email.delivered":
    case "email.bounced":
    case "email.clicked":
    case "email.complained":
    default:
      // No-op for now — we could add a sent/bounce funnel later.
      break;
  }

  return NextResponse.json({ ok: true });
}
