// 1-minute Telegram membership sync.
//
// Runs in the worker process. Every minute, for each connected channel it asks
// the bot for the live status of each KNOWN member (telegram_user_id set) and
// reconciles our DB:
//   - invited/known → in channel  ⇒ mark "active" (+ joined_at)  [join detected]
//   - active        → left/kicked ⇒ mark "removed" (+ removed_at) [leave detected]
//
// This is the bot-API auto-check. It can only see members whose telegram_user_id
// we already captured (via the join webhook or a manual mark) — Telegram's Bot
// API can't enumerate a channel's members, so a brand-new join is still first
// bound by the webhook (which needs the bot to be a channel admin).

import { createAdminClient } from "@/lib/supabase/admin";
import { getChatMemberStatus } from "@/lib/telegram";

const IN_CHANNEL = new Set(["member", "administrator", "creator"]);
const GONE = new Set(["left", "kicked"]);

const TICK_MS = 60_000;
const FIRST_DELAY_MS = 30_000;

async function syncOnce(): Promise<void> {
  const admin = createAdminClient();
  const { data: groups } = await admin
    .from("telegram_vip_groups")
    .select("id, bot_token, group_chat_id, group_id, setup_complete")
    .eq("setup_complete", true)
    .limit(500);

  for (const g of groups ?? []) {
    const botToken = (g.bot_token as string | null) ?? null;
    const chatId =
      ((g.group_chat_id ?? g.group_id) as string | null) ?? null;
    if (!botToken || !chatId) continue;

    const { data: mems } = await admin
      .from("telegram_memberships")
      .select("id, telegram_user_id, status")
      .eq("telegram_group_id", g.id)
      .not("telegram_user_id", "is", null)
      .in("status", ["active", "invited"])
      .limit(1000);

    for (const m of mems ?? []) {
      const uid = Number(m.telegram_user_id);
      if (!Number.isFinite(uid)) continue;
      const st = await getChatMemberStatus(botToken, chatId, uid);
      if (!st) continue;
      if (IN_CHANNEL.has(st) && m.status === "invited") {
        await admin
          .from("telegram_memberships")
          .update({ status: "active", joined_at: new Date().toISOString() })
          .eq("id", m.id);
      } else if (GONE.has(st) && m.status === "active") {
        await admin
          .from("telegram_memberships")
          .update({ status: "removed", removed_at: new Date().toISOString() })
          .eq("id", m.id);
      }
    }
  }
}

let timer: NodeJS.Timeout | null = null;

/** Start the 1-minute sync loop (idempotent). */
export function bootTelegramSyncLoop(): void {
  if (timer) return;
  const run = () => {
    syncOnce().catch((e) => console.error("[telegram-sync] tick failed", e));
  };
  // Let the worker settle before the first run, then every minute.
  setTimeout(run, FIRST_DELAY_MS);
  timer = setInterval(run, TICK_MS);
  console.log("[telegram-sync] 1-minute member sync loop started");
}
