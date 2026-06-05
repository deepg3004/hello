// POST /api/webhooks/discord/[guild_id]
//
// S18 — Discord interactions endpoint. A seller sets this as their bot
// application's "Interactions Endpoint URL" in the Discord Developer Portal.
// Discord verifies the URL by sending a signed PING; we must verify the Ed25519
// signature (against the app's public key) and reply PONG, or Discord rejects
// the URL.
//
// ⚠️ This does NOT auto-detect member joins. Discord delivers GUILD_MEMBER_ADD
// only over a gateway WebSocket, not HTTP — so the invite-link membership model
// (seller "Mark joined" + expiry cron) still stands. This endpoint exists for
// URL verification + future slash commands; it's signature-verified and safe.
//
// The app public key is stored per server (discord_servers.app_public_key,
// migration 059), set during/after setup. Without it we can't verify → 401.

import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// SPKI DER prefix for an Ed25519 public key — prepended to the raw 32-byte key
// so node:crypto can build a KeyObject from Discord's hex public key.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function verifySignature(
  rawBody: string,
  signatureHex: string,
  timestamp: string,
  publicKeyHex: string,
): boolean {
  try {
    const der = Buffer.concat([
      ED25519_SPKI_PREFIX,
      Buffer.from(publicKeyHex, "hex"),
    ]);
    const key = crypto.createPublicKey({ key: der, format: "der", type: "spki" });
    return crypto.verify(
      null,
      Buffer.from(timestamp + rawBody),
      key,
      Buffer.from(signatureHex, "hex"),
    );
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  { params }: { params: { guild_id: string } },
) {
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const rawBody = await request.text();

  if (!signature || !timestamp) {
    return NextResponse.json({ error: "missing signature" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: server } = await admin
    .from("discord_servers")
    .select("app_public_key")
    .eq("guild_id", params.guild_id)
    .maybeSingle();

  const publicKey = server?.app_public_key?.trim();
  if (!publicKey) {
    // No key on file → can't verify. Seller must set the app public key.
    return NextResponse.json({ error: "endpoint not configured" }, { status: 401 });
  }

  if (!verifySignature(rawBody, signature, timestamp, publicKey)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: { type?: number };
  try {
    payload = JSON.parse(rawBody) as { type?: number };
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // PING (type 1) → PONG (type 1). Required for endpoint verification.
  if (payload.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // We register no commands yet; acknowledge other interactions without action.
  return NextResponse.json({ type: 1 });
}
