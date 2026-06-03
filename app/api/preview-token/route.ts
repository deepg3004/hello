// POST /api/preview-token
//
// Body: { values: Record<string, unknown> }  (the page builder's live values)
// Returns: { k }  — a short token the /preview iframe loads via ?k=<token>.
//
// Keeps the live-preview iframe URL tiny so a large page_config can't blow past
// nginx's header-buffer limit (which previously surfaced as a Cloudflare 520).

import { NextResponse } from "next/server";

import { putPreview } from "@/lib/preview-store";

export const dynamic = "force-dynamic";

// Cap the stored blob so this can't be used to balloon memory.
const MAX_BYTES = 512 * 1024; // 512KB — far above any real page_config

export async function POST(request: Request) {
  let body: { values?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body.values !== "object" || body.values === null) {
    return NextResponse.json({ error: "values required" }, { status: 400 });
  }
  const json = JSON.stringify(body.values);
  if (json.length > MAX_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const k = putPreview(json);
  return NextResponse.json({ k });
}
