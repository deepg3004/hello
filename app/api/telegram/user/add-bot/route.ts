import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { addBotToChannel } from "@/lib/telegram-user-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = ["channel", "supergroup", "group"] as const;
type ChannelType = (typeof TYPES)[number];

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { chatId?: string; channelType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { chatId } = body;
  const channelType = body.channelType as ChannelType | undefined;
  if (!chatId || !channelType || !TYPES.includes(channelType)) {
    return NextResponse.json(
      { error: "chatId and a valid channelType are required" },
      { status: 400 },
    );
  }

  try {
    const result = await addBotToChannel(user.id, chatId, channelType);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }
}
