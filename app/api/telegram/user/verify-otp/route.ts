import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptValue } from "@/lib/admin/vault";
import { getRedis } from "@/lib/redis";
import { verifyOtp } from "@/lib/telegram-user-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * MUST match send-code's normalisation exactly — Telegram's auth.signIn
 * rejects (PHONE_NUMBER_INVALID) unless the phone string is byte-identical to
 * the one passed to sendCode.
 */
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

  let body: {
    phone?: string;
    otp?: string;
    phoneCodeHash?: string;
    sessionKey?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { phone, otp, phoneCodeHash, sessionKey } = body;
  if (!phone || !otp || !phoneCodeHash || !sessionKey) {
    return NextResponse.json(
      { error: "phone, otp, phoneCodeHash and sessionKey are required" },
      { status: 400 },
    );
  }

  // Normalise identically to send-code so auth.signIn gets the same string.
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  try {
    const result = await verifyOtp(normalizedPhone, otp, phoneCodeHash, sessionKey);
    const name = [result.firstName, result.lastName].filter(Boolean).join(" ");

    const admin = createAdminClient();
    const nowIso = new Date().toISOString();
    const { error } = await admin.from("telegram_user_sessions").upsert(
      {
        user_id: user.id,
        telegram_user_id: result.userId.toString(),
        telegram_phone: normalizedPhone,
        telegram_username: result.username ?? null,
        telegram_name: name || null,
        session_string: encryptValue(result.sessionString),
        connected_at: nowIso,
        last_used_at: nowIso,
      },
      { onConflict: "user_id" },
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Bust any stale channel cache for this user.
    const redis = getRedis();
    if (redis) await redis.del(`tg_channels:${user.id}`);

    return NextResponse.json({
      ok: true,
      telegramUser: {
        id: result.userId.toString(),
        username: result.username ?? null,
        name,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
