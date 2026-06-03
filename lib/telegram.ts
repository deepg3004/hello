// =============================================================================
// Telegram bot helpers.
//
// We use node-telegram-bot-api for type help but go through direct fetch to the
// Bot API for everything that matters — it keeps every call serverless-clean
// (no polling threads, no event loops, no socket reuse), which matters because
// these run inside route handlers and cron endpoints.
//
// NEVER import this from a client component — bot tokens stay server-side.
// =============================================================================

import TelegramBot from "node-telegram-bot-api";

const BASE = (token: string) => `https://api.telegram.org/bot${token}`;

interface TgError {
  ok: false;
  description: string;
  error_code?: number;
}
interface TgOk<T> {
  ok: true;
  result: T;
}
type TgResponse<T> = TgOk<T> | TgError;

async function call<T>(
  token: string,
  method: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${BASE(token)}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const body = (await res.json()) as TgResponse<T>;
  if (!body.ok) {
    throw new Error(`Telegram ${method}: ${body.description}`);
  }
  return body.result;
}

// ----------------------------------------------------------------------------
// Bot inspection
// ----------------------------------------------------------------------------

export interface BotInfo {
  id: number;
  username: string;
  first_name: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
}

/** Calls Telegram getMe — validates the token and returns the bot identity. */
export async function getBotInfo(botToken: string): Promise<BotInfo> {
  return call<BotInfo>(botToken, "getMe");
}

// ----------------------------------------------------------------------------
// Group inspection
// ----------------------------------------------------------------------------

export interface ChatInfo {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
}

export async function getChat(
  botToken: string,
  chatId: string | number,
): Promise<ChatInfo> {
  return call<ChatInfo>(botToken, "getChat", { chat_id: chatId });
}

interface ChatAdmin {
  user: { id: number; is_bot: boolean; username?: string };
  status: string;
  can_invite_users?: boolean;
  can_restrict_members?: boolean;
}

/**
 * Verify the bot is an admin in the given group with the perms it needs
 * (invite users + restrict members). Returns the resolved chat + the bot's
 * admin record so callers can show "found".
 */
export async function verifyBotInGroup(
  botToken: string,
  chatId: string | number,
): Promise<{ chat: ChatInfo; bot: ChatAdmin }> {
  const chat = await getChat(botToken, chatId);
  const admins = await call<ChatAdmin[]>(botToken, "getChatAdministrators", {
    chat_id: chatId,
  });
  const me = await getBotInfo(botToken);
  const bot = admins.find((a) => a.user.id === me.id);
  if (!bot) {
    throw new Error("Bot is not an admin in this group. Add it as admin and try again.");
  }
  if (!bot.can_invite_users || !bot.can_restrict_members) {
    throw new Error(
      "Bot needs Invite Users + Restrict Members admin permissions.",
    );
  }
  return { chat, bot };
}

// ----------------------------------------------------------------------------
// Invite link
// ----------------------------------------------------------------------------

export interface InviteLink {
  invite_link: string;
  expire_date?: number;
  member_limit?: number;
}

/**
 * Generate a one-time invite link that's good for `durationMinutes` and
 * usable by at most one Telegram user.
 */
export async function generateInviteLink(
  botToken: string,
  chatId: string | number,
  durationMinutes = 10,
  name?: string,
): Promise<InviteLink> {
  const expire_date = Math.floor(Date.now() / 1000) + durationMinutes * 60;
  return call<InviteLink>(botToken, "createChatInviteLink", {
    chat_id: chatId,
    expire_date,
    member_limit: 1,
    name: name?.slice(0, 32),
  });
}

// ----------------------------------------------------------------------------
// Membership management
// ----------------------------------------------------------------------------

/**
 * Kick a buyer out of the VIP group when their access expires.
 *
 * Telegram requires us to ban then unban (otherwise they can't be re-added
 * after renewal). We pass `revoke_messages: false` so the buyer's history
 * stays for the rest of the group.
 */
export async function kickMember(
  botToken: string,
  chatId: string | number,
  telegramUserId: number,
): Promise<void> {
  await call(botToken, "banChatMember", {
    chat_id: chatId,
    user_id: telegramUserId,
    revoke_messages: false,
  });
  // Immediately unban so they can be re-invited later on renewal.
  await call(botToken, "unbanChatMember", {
    chat_id: chatId,
    user_id: telegramUserId,
    only_if_banned: true,
  });
}

/**
 * Read a member's current status in the chat (member/administrator/creator =
 * in the channel; left/kicked = gone). Returns null if the member was never
 * seen / the lookup fails. Used by the 1-minute sync to auto-detect join/leave.
 */
export async function getChatMemberStatus(
  botToken: string,
  chatId: string | number,
  telegramUserId: number,
): Promise<string | null> {
  try {
    const res = await call<{ status?: string }>(botToken, "getChatMember", {
      chat_id: chatId,
      user_id: telegramUserId,
    });
    return res.status ?? null;
  } catch {
    return null;
  }
}

/**
 * Permanently ban a member — banChatMember WITHOUT the follow-up unban, so the
 * user cannot rejoin via any invite link until manually unbanned. Used by the
 * seller "Ban" action (vs kickMember which is a removable revoke).
 */
export async function banMember(
  botToken: string,
  chatId: string | number,
  telegramUserId: number,
): Promise<void> {
  await call(botToken, "banChatMember", {
    chat_id: chatId,
    user_id: telegramUserId,
    revoke_messages: false,
  });
}

// ----------------------------------------------------------------------------
// Webhook
// ----------------------------------------------------------------------------

/**
 * Tell Telegram to deliver chat_member updates to our endpoint. We only
 * subscribe to the events we care about so traffic stays small.
 *
 * `secretToken` (optional but required in production callers) is echoed
 * back by Telegram in the `X-Telegram-Bot-Api-Secret-Token` header on
 * every webhook delivery. The webhook handler verifies it so an attacker
 * who knows our group_id can't forge join/leave events.
 */
export async function setWebhook(
  botToken: string,
  url: string,
  secretToken?: string,
): Promise<void> {
  const payload: Record<string, unknown> = {
    url,
    allowed_updates: ["chat_member", "my_chat_member"],
    drop_pending_updates: false,
  };
  if (secretToken) payload.secret_token = secretToken;
  await call(botToken, "setWebhook", payload);
}

export async function deleteWebhook(botToken: string): Promise<void> {
  await call(botToken, "deleteWebhook", { drop_pending_updates: false });
}

// ----------------------------------------------------------------------------
// Re-export the node-telegram-bot-api class for callers who want richer
// helpers (file uploads, message editing, etc) later. We don't instantiate it
// in this file because each helper above is single-shot.
// ----------------------------------------------------------------------------
export { TelegramBot };
