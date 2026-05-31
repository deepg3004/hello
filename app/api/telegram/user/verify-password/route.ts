import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getRedis } from "@/lib/redis";
import { verifyPassword, persistTelegramSession } from "@/lib/telegram-user-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let body: { password?: string; sessionKey?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { password, sessionKey, phone } = body;
  if (!password || !sessionKey || !phone) {
    return NextResponse.json(
      { error: "password, sessionKey and phone are required" },
      { status: 400 },
    );
  }
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  try {
    const authUser = await verifyPassword(password, sessionKey);
    const tgUser = await persistTelegramSession(user.id, normalizedPhone, authUser);

    const redis = getRedis();
    if (redis) await redis.del(`tg_channels:${user.id}`);

    return NextResponse.json({ ok: true, telegramUser: tgUser });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
