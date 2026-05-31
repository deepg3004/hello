import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getRedis } from "@/lib/redis";
import { getUserChannels } from "@/lib/telegram-user-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const cacheKey = `tg_channels:${user.id}`;
  const redis = getRedis();

  if (redis && !refresh) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json({ channels: JSON.parse(cached), cached: true });
    }
  }

  try {
    const channels = await getUserChannels(user.id);
    if (redis) await redis.set(cacheKey, JSON.stringify(channels), "EX", 300);
    return NextResponse.json({ channels });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
