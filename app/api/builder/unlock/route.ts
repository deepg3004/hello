// POST /api/builder/unlock  { pageId, password }
//
// Verifies a visitor's password against a gated builder page and, on success,
// sets the signed unlock cookie the public renderer checks. Public endpoint
// (no auth) — rate-limited so the shared password can't be brute-forced.

import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { unlockCookieName, unlockToken } from "@/lib/builder-unlock";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  let body: { pageId?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const pageId = (body.pageId ?? "").trim();
  const password = (body.password ?? "").trim();
  if (!pageId || !password) {
    return NextResponse.json({ error: "Enter the password." }, { status: 400 });
  }

  const rl = await rateLimit(`builder-unlock:${pageId}:${clientIp(request)}`, 12, 15 * 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("builder_pages")
    .select("access_password")
    .eq("id", pageId)
    .maybeSingle();
  const stored = (page?.access_password as string | null) ?? "";
  if (!stored) return NextResponse.json({ error: "This page isn't locked." }, { status: 400 });

  // Constant-time compare so timing can't leak the password.
  const a = Buffer.from(password);
  const b = Buffer.from(stored);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return NextResponse.json({ error: "Wrong password." }, { status: 401 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: unlockCookieName(pageId),
    value: unlockToken(pageId, stored),
    maxAge: 30 * 86_400,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  return response;
}
