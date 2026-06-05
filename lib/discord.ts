// =============================================================================
// Discord bot helpers.
//
// Direct fetch to the Discord REST API (v10) — keeps every call serverless-clean
// (no gateway socket, no event loop), the same shape as lib/telegram.ts. We use
// a Bot token (Authorization: Bot <token>) for every call.
//
// NEVER import this from a client component — bot tokens stay server-side.
//
// Discord has no HTTP webhook for member joins (that needs a gateway WebSocket),
// so the v1 invite-link flow can't auto-flip a membership to "active" the way
// the Telegram chat_member webhook does. Sellers can "Mark joined" manually, and
// the expiry cron kicks only when discord_user_id is known. The OAuth2 flow
// (added later) populates discord_user_id at join time and removes that gap.
// =============================================================================

const BASE = "https://discord.com/api/v10";

// Permission bit flags we care about (Discord permissions are a bitfield
// returned as a decimal string in the bot's partial-guild object).
const PERM_CREATE_INSTANT_INVITE = 1n << 0n;
const PERM_KICK_MEMBERS = 1n << 1n;
const PERM_ADMINISTRATOR = 1n << 3n;
const CHANNEL_TYPE_GUILD_TEXT = 0;

interface DiscordError {
  message?: string;
  code?: number;
}

async function call<T>(
  token: string,
  path: string,
  init?: { method?: string; body?: Record<string, unknown> },
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      authorization: `Bot ${token}`,
      "content-type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? (JSON.parse(text) as T | DiscordError) : ({} as T);
  if (!res.ok) {
    const msg = (body as DiscordError)?.message ?? res.statusText;
    throw new Error(`Discord ${path}: ${msg}`);
  }
  return body as T;
}

function hasPerm(permissions: string | undefined, flag: bigint): boolean {
  if (!permissions) return false;
  let bits: bigint;
  try {
    bits = BigInt(permissions);
  } catch {
    return false;
  }
  return (bits & PERM_ADMINISTRATOR) !== 0n || (bits & flag) !== 0n;
}

// ----------------------------------------------------------------------------
// Bot inspection
// ----------------------------------------------------------------------------

export interface BotInfo {
  id: string;
  username: string;
  bot?: boolean;
}

/** GET /users/@me — validates the token and returns the bot identity. */
export async function getBotInfo(botToken: string): Promise<BotInfo> {
  return call<BotInfo>(botToken, "/users/@me");
}

interface PartialGuild {
  id: string;
  name: string;
  permissions?: string;
}

/** GET /users/@me/guilds — the guilds this bot has been added to (partial). */
export async function getBotGuilds(botToken: string): Promise<PartialGuild[]> {
  return call<PartialGuild[]>(botToken, "/users/@me/guilds");
}

interface GuildChannel {
  id: string;
  name: string;
  type: number;
  position?: number;
}

export async function getGuildChannels(
  botToken: string,
  guildId: string,
): Promise<GuildChannel[]> {
  return call<GuildChannel[]>(botToken, `/guilds/${guildId}/channels`);
}

export interface VerifiedGuild {
  guild: PartialGuild;
  can_invite: boolean;
  can_kick: boolean;
  invite_channel_id: string | null;
}

/**
 * Verify the bot is in the guild with the perms it needs (create invite +
 * kick members) and resolve a text channel to mint invites on. Returns the
 * guild plus capability flags so the setup wizard can show "found".
 */
export async function verifyBotInGuild(
  botToken: string,
  guildId: string,
): Promise<VerifiedGuild> {
  const guilds = await getBotGuilds(botToken);
  const guild = guilds.find((g) => g.id === guildId.trim());
  if (!guild) {
    throw new Error(
      "Bot is not in this server. Use the invite link to add it, then try again.",
    );
  }
  const can_invite = hasPerm(guild.permissions, PERM_CREATE_INSTANT_INVITE);
  const can_kick = hasPerm(guild.permissions, PERM_KICK_MEMBERS);
  if (!can_invite) {
    throw new Error(
      "Bot needs the Create Invite permission. Give it a role with that permission and try again.",
    );
  }

  // Resolve the first text channel for invite generation.
  let invite_channel_id: string | null = null;
  try {
    const channels = await getGuildChannels(botToken, guildId.trim());
    const text = channels
      .filter((c) => c.type === CHANNEL_TYPE_GUILD_TEXT)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    invite_channel_id = text[0]?.id ?? null;
  } catch {
    /* channel listing optional — invite creation will surface the error */
  }

  return { guild, can_invite, can_kick, invite_channel_id };
}

// ----------------------------------------------------------------------------
// Invite link
// ----------------------------------------------------------------------------

export interface InviteLink {
  code: string;
  invite_link: string;
  uses: number;
  max_uses: number;
}

/**
 * Mint a unique invite on `channelId`, good for `durationMinutes` and usable by
 * at most one member (mirrors the Telegram one-time invite). `unique: true`
 * forces a fresh code per buyer instead of reusing an existing one.
 */
export async function createInvite(
  botToken: string,
  channelId: string,
  durationMinutes = 60 * 24,
  maxUses = 1,
): Promise<InviteLink> {
  const inv = await call<{ code: string; uses?: number; max_uses?: number }>(
    botToken,
    `/channels/${channelId}/invites`,
    {
      method: "POST",
      body: {
        max_age: durationMinutes * 60, // seconds; 0 = never
        max_uses: maxUses, // 0 = unlimited
        unique: true,
        temporary: false,
      },
    },
  );
  return {
    code: inv.code,
    invite_link: `https://discord.gg/${inv.code}`,
    uses: inv.uses ?? 0,
    max_uses: inv.max_uses ?? maxUses,
  };
}

/** GET /invites/{code}?with_counts — how many times an invite has been used. */
export async function getInviteUses(
  botToken: string,
  code: string,
): Promise<number | null> {
  try {
    const inv = await call<{ uses?: number }>(
      botToken,
      `/invites/${code}?with_counts=true`,
    );
    return inv.uses ?? null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Membership management
// ----------------------------------------------------------------------------

/**
 * Remove a member from the guild when their access expires. Discord has no
 * ban-then-unban dance like Telegram — a plain DELETE kicks them, and they can
 * rejoin via a fresh invite on renewal. Requires the member's snowflake id.
 */
export async function kickMember(
  botToken: string,
  guildId: string,
  discordUserId: string,
): Promise<void> {
  await call(botToken, `/guilds/${guildId}/members/${discordUserId}`, {
    method: "DELETE",
  });
}

/** Permanently ban a member — they cannot rejoin via any invite until unbanned. */
export async function banMember(
  botToken: string,
  guildId: string,
  discordUserId: string,
): Promise<void> {
  await call(botToken, `/guilds/${guildId}/bans/${discordUserId}`, {
    method: "PUT",
    body: { delete_message_seconds: 0 },
  });
}

// ----------------------------------------------------------------------------
// Role helpers — reserved for the OAuth2 + role fulfillment model (v2). Unused
// by the v1 invite-link flow, but kept here so that layer needs no new lib code.
// ----------------------------------------------------------------------------

export async function addRole(
  botToken: string,
  guildId: string,
  discordUserId: string,
  roleId: string,
): Promise<void> {
  await call(
    botToken,
    `/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
    { method: "PUT" },
  );
}

export async function removeRole(
  botToken: string,
  guildId: string,
  discordUserId: string,
  roleId: string,
): Promise<void> {
  await call(
    botToken,
    `/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
    { method: "DELETE" },
  );
}
