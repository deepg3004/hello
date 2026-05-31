import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getRedis } from "@/lib/redis";
import { sendCode } from "@/lib/telegram-user-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Normalise an Indian phone number to E.164 (+91XXXXXXXXXX). */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (raw.trim().startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone = normalizePhone(body.phone ?? "");
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid phone number (10-digit Indian or +country code)." },
      { status: 400 },
    );
  }

  // Rate limit: max 3 OTP sends per phone per hour.
  const redis = getRedis();
  if (redis) {
    const key = `tg_send:${phone}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3600);
    if (count > 3) {
      return NextResponse.json(
        { error: "Too many OTP requests. Try again in an hour." },
        { status: 429 },
      );
    }
  }

  try {
    const { phoneCodeHash, sessionKey } = await sendCode(phone);
    return NextResponse.json({ ok: true, phoneCodeHash, sessionKey });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
