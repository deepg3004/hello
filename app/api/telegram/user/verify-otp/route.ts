import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptValue } from "@/lib/admin/vault";
import { getRedis } from "@/lib/redis";
import { verifyOtp } from "@/lib/telegram-user-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  try {
    const result = await verifyOtp(phone, otp, phoneCodeHash, sessionKey);
    const name = [result.firstName, result.lastName].filter(Boolean).join(" ");

    const admin = createAdminClient();
    const nowIso = new Date().toISOString();
    const { error } = await admin.from("telegram_user_sessions").upsert(
      {
        user_id: user.id,
        telegram_user_id: result.userId.toString(),
        telegram_phone: phone,
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
