import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getRedis } from "@/lib/redis";
import { createChannel } from "@/lib/telegram-user-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; about?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const about = (body.about ?? "").trim();
  if (!title || title.length > 128) {
    return NextResponse.json(
      { error: "Channel title is required (max 128 chars)." },
      { status: 400 },
    );
  }

  try {
    const channel = await createChannel(user.id, title, about);
    // New channel — invalidate the cached channel list.
    const redis = getRedis();
    if (redis) await redis.del(`tg_channels:${user.id}`);
    return NextResponse.json({ ok: true, ...channel });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
