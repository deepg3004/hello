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
import WebSocket from "ws";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram";
import { ConnectionTCPFull } from "telegram/network";
import { computeCheck } from "telegram/Password";
import { LogLevel } from "telegram/extensions/Logger";
import bigInt from "big-integer";

// GramJS 2.26 eagerly requires a global WebSocket at client construction even
// when using the raw-TCP transport. Node 20 has no global WebSocket, so it
// throws "Node.js 20 detected without native WebSocket support". Polyfill it
// with `ws`. (We still force ConnectionTCPFull for the actual transport.)
{
  const g = globalThis as { WebSocket?: unknown };
  if (typeof g.WebSocket === "undefined") {
    g.WebSocket = WebSocket as unknown;
  }
}

import { decryptValue, encryptValue } from "@/lib/admin/vault";
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
      // Force raw TCP. GramJS 2.26 otherwise tries a WebSocket transport, which
      // throws "Node.js 20 detected without native WebSocket support" / hangs
      // (Error: TIMEOUT) on this server. TCP to Telegram DCs :443 is reachable.
      connection: ConnectionTCPFull,
      useWSS: false,
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

export interface TgAuthUser {
  sessionString: string;
  userId: bigint;
  username: string | undefined;
  firstName: string;
  lastName: string | undefined;
}

export type VerifyOtpResult =
  | { status: "ok"; user: TgAuthUser }
  | { status: "password_needed" };

function authUserFrom(client: TelegramClient, user: Api.User): TgAuthUser {
  return {
    sessionString: (client.session as StringSession).save(),
    userId: BigInt(user.id.toString()),
    username: user.username ?? undefined,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? undefined,
  };
}

/**
 * Step 2: verify the OTP. Returns the authenticated session on success, or
 * `{status: "password_needed"}` when the account has 2FA — in which case the
 * pending session is kept in Redis so verifyPassword() can finish the login.
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
        new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash, phoneCode: otp }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("SESSION_PASSWORD_NEEDED")) {
        // Persist the in-progress session so the password step can resume it.
        if (redis) {
          await redis.set(sessionKey, (client.session as StringSession).save(), "EX", 600);
        }
        return { status: "password_needed" };
      }
      throw e;
    }

    if (result instanceof Api.auth.AuthorizationSignUpRequired) {
      throw new Error("This phone number is not registered on Telegram.");
    }
    const user = authUserFrom(client, result.user as Api.User);
    if (redis) await redis.del(sessionKey);
    return { status: "ok", user };
  } finally {
    await client.disconnect();
  }
}

/**
 * Step 2b (2FA accounts only): complete login with the cloud password using
 * Telegram's SRP check. `sessionKey` is the same one from sendCode/verifyOtp.
 */
export async function verifyPassword(
  password: string,
  sessionKey: string,
): Promise<TgAuthUser> {
  assertConfigured();
  const redis = getRedis();
  const pending = redis ? (await redis.get(sessionKey)) ?? "" : "";
  if (!pending) {
    throw new Error("Login session expired. Please restart and request a new code.");
  }
  const client = makeClient(pending);
  await client.connect();
  try {
    const pwd = await client.invoke(new Api.account.GetPassword());
    const check = await computeCheck(pwd, password);
    const result = await client.invoke(new Api.auth.CheckPassword({ password: check }));
    if (result instanceof Api.auth.AuthorizationSignUpRequired) {
      throw new Error("This phone number is not registered on Telegram.");
    }
    const user = authUserFrom(client, result.user as Api.User);
    if (redis) await redis.del(sessionKey);
    return user;
  } finally {
    await client.disconnect();
  }
}

/**
 * Encrypt + upsert a completed login into telegram_user_sessions. Used by both
 * the OTP path and the 2FA-password path so persistence stays identical.
 */
export async function persistTelegramSession(
  invoxUserId: string,
  phone: string,
  u: TgAuthUser,
): Promise<{ id: string; username: string | null; name: string }> {
  const admin = createAdminClient();
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
  const nowIso = new Date().toISOString();
  const { error } = await admin.from("telegram_user_sessions").upsert(
    {
      user_id: invoxUserId,
      telegram_user_id: u.userId.toString(),
      telegram_phone: phone,
      telegram_username: u.username ?? null,
      telegram_name: name || null,
      session_string: encryptValue(u.sessionString),
      connected_at: nowIso,
      last_used_at: nowIso,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return { id: u.userId.toString(), username: u.username ?? null, name };
}

// ── Channels / dialogs ──────────────────────────────────────────────────────

export interface TgChannel {
  id: string; // numeric MTProto id (as string)
  accessHash?: string; // required to address a channel from a fresh session
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
          accessHash: entity.accessHash?.toString(),
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
  accessHash?: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!BOT_USERNAME) {
    return { ok: false, message: "TELEGRAM_BOT_USERNAME is not configured." };
  }
  const client = await connectedClientFor(invoxUserId);
  const ignore = (e: unknown, marker: string): void => {
    const m = e instanceof Error ? e.message : String(e);
    if (!m.includes(marker)) throw e;
  };
  try {
    // Basic groups (Api.Chat) have no access_hash and use a different API.
    if (channelType === "group") {
      try {
        await client.invoke(
          new Api.messages.AddChatUser({
            chatId: bigInt(chatId),
            userId: BOT_USERNAME,
            fwdLimit: 50,
          }),
        );
      } catch (e) {
        ignore(e, "USER_ALREADY_PARTICIPANT");
      }
      return { ok: true };
    }

    // Channels / supergroups: a bot is added by PROMOTING it to admin —
    // channels.InviteToChannel rejects bots with USER_BOT. EditAdmin adds +
    // promotes in one step. Address directly via (id, access_hash) so we never
    // hang resolving a bare id from a fresh session (was Error: TIMEOUT).
    const channel = new Api.InputChannel({
      channelId: bigInt(chatId),
      accessHash: bigInt(accessHash ?? "0"),
    });
    await client.invoke(
      new Api.channels.EditAdmin({
        channel,
        userId: BOT_USERNAME,
        adminRights: new Api.ChatAdminRights({
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
