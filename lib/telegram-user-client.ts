/**
 * Telegram MTProto User API client (GramJS).
 *
 * SERVER ONLY — never import from a client component. All calls run in API
 * routes / server actions. Logging in as a user (phone OTP) lets us enumerate
 * the channels/groups they own or admin, which the Bot API cannot do.
 *
 * SECURITY: each user's GramJS session string is AES-256-GCM encrypted (vault)
 * before it touches the DB. A session grants full access to that Telegram
 * account, so treat telegram_user_sessions.session_string as a top secret.
 */
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram";
import { LogLevel } from "telegram/extensions/Logger";
import bigInt from "big-integer";

import { decryptValue } from "@/lib/admin/vault";
import { getRedis } from "@/lib/redis";
import { createAdminClient } from "@/lib/supabase/admin";

const API_ID = parseInt(process.env.TELEGRAM_API_ID ?? "0", 10);
const API_HASH = process.env.TELEGRAM_API_HASH ?? "";
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "";

/** Throws a clear error if platform MTProto creds are missing. */
function assertConfigured(): void {
  if (!API_ID || !API_HASH) {
    throw new Error(
      "Telegram MTProto not configured — set TELEGRAM_API_ID and " +
        "TELEGRAM_API_HASH (create an app at https://my.telegram.org/apps).",
    );
  }
}

/** Build a fresh, unconnected client. */
function makeClient(sessionString = ""): TelegramClient {
  const client = new TelegramClient(
    new StringSession(sessionString),
    API_ID,
    API_HASH,
    {
      connectionRetries: 3,
      timeout: 15,
      deviceModel: "InvoxAI Platform",
      appVersion: "1.0",
    },
  );
  // GramJS is very chatty by default; keep only errors.
  client.setLogLevel(LogLevel.ERROR);
  return client;
}

/** Load + decrypt a user's stored session and return a connected client. */
async function connectedClientFor(invoxUserId: string): Promise<TelegramClient> {
  assertConfigured();
  const admin = createAdminClient();
  const { data: sess } = await admin
    .from("telegram_user_sessions")
    .select("session_string")
    .eq("user_id", invoxUserId)
    .maybeSingle();
  if (!sess) {
    throw new Error("No Telegram session. Please connect your account first.");
  }
  const client = makeClient(decryptValue(sess.session_string));
  await client.connect();
  // Best-effort last_used bump (don't block on it).
  void admin
    .from("telegram_user_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", invoxUserId);
  return client;
}

// ── Phone auth ────────────────────────────────────────────────────────────

export interface SendCodeResult {
  phoneCodeHash: string;
  sessionKey: string; // Redis key holding the pending (pre-login) session
}

/**
 * Step 1: send an OTP to the user's Telegram. The pre-login session is parked
 * in Redis for 10 minutes so verifyOtp() can resume the same auth flow.
 */
export async function sendCode(phone: string): Promise<SendCodeResult> {
  assertConfigured();
  const client = makeClient();
  await client.connect();
  try {
    const result = await client.sendCode(
      { apiId: API_ID, apiHash: API_HASH },
      phone,
    );
    const sessionStr = (client.session as StringSession).save();
    const sessionKey = `tg_auth:${phone.replace(/\D/g, "")}:${Date.now()}`;
    const redis = getRedis();
    if (redis) await redis.set(sessionKey, sessionStr, "EX", 600);
    return { phoneCodeHash: result.phoneCodeHash, sessionKey };
  } finally {
    await client.disconnect();
  }
}

export interface VerifyOtpResult {
  sessionString: string;
  userId: bigint;
  username: string | undefined;
  firstName: string;
  lastName: string | undefined;
}

/**
 * Step 2: verify the OTP and return the now-authenticated session string
 * (caller must encrypt before storing). Surfaces clear errors for the two
 * common edge cases: 2FA-enabled accounts and sign-up-required numbers.
 */
export async function verifyOtp(
  phone: string,
  otp: string,
  phoneCodeHash: string,
  sessionKey: string,
): Promise<VerifyOtpResult> {
  assertConfigured();
  const redis = getRedis();
  const pending = redis ? (await redis.get(sessionKey)) ?? "" : "";
  const client = makeClient(pending);
  await client.connect();
  try {
    let result: Api.auth.TypeAuthorization;
    try {
      result = await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: phone,
          phoneCodeHash,
          phoneCode: otp,
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("SESSION_PASSWORD_NEEDED")) {
        throw new Error(
          "This Telegram account has two-step verification (2FA) enabled, " +
            "which isn't supported yet. Disable it temporarily or use an " +
            "account without 2FA.",
        );
      }
      throw e;
    }

    if (result instanceof Api.auth.AuthorizationSignUpRequired) {
      throw new Error("This phone number is not registered on Telegram.");
    }
    const user = result.user as Api.User;
    const sessionString = (client.session as StringSession).save();
    if (redis) await redis.del(sessionKey);
    return {
      sessionString,
      userId: BigInt(user.id.toString()),
      username: user.username ?? undefined,
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? undefined,
    };
  } finally {
    await client.disconnect();
  }
}

// ── Channels / dialogs ──────────────────────────────────────────────────────

export interface TgChannel {
  id: string; // numeric MTProto id (as string)
  title: string;
  type: "channel" | "supergroup" | "group";
  username?: string;
  memberCount?: number;
  isMegagroup: boolean;
  isCreator: boolean;
  isBroadcast: boolean;
}

/** All channels/groups where the user is creator or admin. */
export async function getUserChannels(invoxUserId: string): Promise<TgChannel[]> {
  const client = await connectedClientFor(invoxUserId);
  try {
    const dialogs = await client.getDialogs({ limit: 200 });
    const channels: TgChannel[] = [];

    for (const dialog of dialogs) {
      if (!dialog.isChannel && !dialog.isGroup) continue;
      const entity = dialog.entity;
      if (!entity) continue;

      if (entity instanceof Api.Channel) {
        if (!entity.creator && !entity.adminRights) continue; // admin only
        channels.push({
          id: String(entity.id),
          title: entity.title ?? "Unnamed",
          type: entity.broadcast ? "channel" : "supergroup",
          username: entity.username ?? undefined,
          memberCount: entity.participantsCount ?? undefined,
          isMegagroup: !!entity.megagroup,
          isCreator: !!entity.creator,
          isBroadcast: !!entity.broadcast,
        });
      } else if (entity instanceof Api.Chat) {
        if (!entity.creator && !entity.adminRights) continue;
        channels.push({
          id: String(entity.id),
          title: entity.title ?? "Unnamed",
          type: "group",
          memberCount: entity.participantsCount ?? undefined,
          isMegagroup: false,
          isCreator: !!entity.creator,
          isBroadcast: false,
        });
      }
    }
    return channels;
  } finally {
    await client.disconnect();
  }
}

/**
 * Add the InvoxAI platform bot to a channel/group and promote it to admin
 * with the rights needed to invite + remove members.
 */
export async function addBotToChannel(
  invoxUserId: string,
  chatId: string,
  channelType: "channel" | "supergroup" | "group",
): Promise<{ ok: boolean; message?: string }> {
  if (!BOT_USERNAME) {
    return { ok: false, message: "TELEGRAM_BOT_USERNAME is not configured." };
  }
  const client = await connectedClientFor(invoxUserId);
  try {
    const entity = await client.getEntity(bigInt(chatId));
    await client.invoke(
      new Api.channels.InviteToChannel({
        channel: entity,
        users: [BOT_USERNAME],
      }),
    );
    await client.invoke(
      new Api.channels.EditAdmin({
        channel: entity,
        userId: BOT_USERNAME,
        adminRights: new Api.ChatAdminRights({
          // banUsers covers restricting/removing members (there is no separate
          // restrictMembers flag in MTProto ChatAdminRights).
          inviteUsers: true,
          banUsers: true,
          deleteMessages: true,
          postMessages: channelType === "channel",
          editMessages: channelType === "channel",
        }),
        rank: "InvoxAI Bot",
      }),
    );
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("USER_ALREADY_PARTICIPANT")) return { ok: true };
    return { ok: false, message: msg };
  } finally {
    await client.disconnect();
  }
}

/** Create a brand-new broadcast channel on behalf of the user. */
export async function createChannel(
  invoxUserId: string,
  title: string,
  about: string,
): Promise<{ id: string; accessHash: string; username?: string }> {
  const client = await connectedClientFor(invoxUserId);
  try {
    const result = await client.invoke(
      new Api.channels.CreateChannel({
        title,
        about,
        megagroup: false,
        broadcast: true,
      }),
    );
    const chats = (result as Api.Updates).chats;
    const ch = chats.find((c): c is Api.Channel => c instanceof Api.Channel);
    if (!ch) throw new Error("Channel creation failed.");
    return {
      id: String(ch.id),
      accessHash: ch.accessHash?.toString() ?? "",
      username: ch.username ?? undefined,
    };
  } finally {
    await client.disconnect();
  }
}
