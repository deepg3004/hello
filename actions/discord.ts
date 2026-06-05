"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
import {
  banMember,
  createInvite,
  getBotInfo,
  kickMember,
  verifyBotInGuild,
} from "@/lib/discord";

export interface ActionResult<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
}

// ----------------------------------------------------------------------------
// Setup-wizard validations (no DB write)
// ----------------------------------------------------------------------------

export interface VerifiedBot {
  username: string;
  id: string;
}

/** Step 1 — validates the bot token by calling Discord GET /users/@me. */
export async function verifyDiscordBotTokenAction(
  botToken: string,
): Promise<ActionResult<VerifiedBot>> {
  const token = botToken.trim();
  // Discord bot tokens are 3 dot-separated base64url segments.
  if (!token || token.split(".").length < 3) {
    return { ok: false, message: "That doesn't look like a Discord bot token." };
  }
  try {
    const me = await getBotInfo(token);
    return { ok: true, data: { username: me.username, id: me.id } };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Step 3 — validates the guild + bot permissions, resolves an invite channel. */
export async function verifyGuildAction(
  botToken: string,
  guildId: string,
): Promise<
  ActionResult<{
    guild_id: string;
    name: string;
    bot_can_invite: boolean;
    bot_can_kick: boolean;
    invite_channel_id: string | null;
  }>
> {
  try {
    const v = await verifyBotInGuild(botToken.trim(), guildId.trim());
    return {
      ok: true,
      data: {
        guild_id: v.guild.id,
        name: v.guild.name,
        bot_can_invite: v.can_invite,
        bot_can_kick: v.can_kick,
        invite_channel_id: v.invite_channel_id,
      },
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ----------------------------------------------------------------------------
// Save the setup
// ----------------------------------------------------------------------------

/** One subscription tier (Weekly/Monthly/Yearly/Lifetime). Each becomes a
 *  products row on the linked page — the same model as Telegram. */
export interface DiscordPlanInput {
  label: string;
  duration_days: number | null; // null = lifetime
  price: number; // INR
}

export interface SaveSetupInput {
  bot_token: string;
  bot_username?: string;
  guild_id: string;
  guild_name?: string;
  invite_channel_id?: string | null;
  vip_role_id?: string | null;
  app_public_key?: string | null;
  access_duration_days: number;
  auto_renewal_enabled: boolean;
  page_id?: string;
  plans?: DiscordPlanInput[];
}

export async function saveDiscordSetupAction(
  input: SaveSetupInput,
): Promise<ActionResult<{ id: string }>> {
  const actor = await requireActor("discord.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();

  const row = {
    user_id: ctx.ownerId,
    page_id: input.page_id ?? null,
    bot_token: input.bot_token,
    bot_username: input.bot_username ?? null,
    guild_id: input.guild_id,
    guild_name: input.guild_name ?? null,
    invite_channel_id: input.invite_channel_id ?? null,
    vip_role_id: input.vip_role_id ?? null,
    app_public_key: input.app_public_key?.trim() || null,
    access_duration_days: input.access_duration_days,
    auto_renewal_enabled: input.auto_renewal_enabled,
    setup_complete: true,
  };

  const { data: inserted, error } = await admin
    .from("discord_servers")
    .insert(row)
    .select("id")
    .single();
  if (error || !inserted) {
    return { ok: false, message: error?.message ?? "Insert failed" };
  }

  // If linked to a page, point the page at this server + create tier products.
  if (input.page_id) {
    await admin
      .from("pages")
      .update({ discord_server_id: inserted.id })
      .eq("id", input.page_id)
      .eq("user_id", ctx.ownerId);

    const plans = (input.plans ?? []).filter((p) => p.label && p.price > 0);
    if (plans.length > 0) {
      await admin
        .from("products")
        .update({ active: false })
        .eq("page_id", input.page_id)
        .eq("user_id", ctx.ownerId);

      const rows = plans.map((p, idx) => ({
        user_id: ctx.ownerId,
        page_id: input.page_id,
        name: `${p.label} access`,
        display_label: p.label,
        price: p.price,
        currency: "INR",
        type: "one_time" as const,
        subscription_days: p.duration_days,
        sort_order: idx,
        active: true,
      }));
      const { error: prodErr } = await admin.from("products").insert(rows);
      if (prodErr) {
        return {
          ok: true,
          data: { id: inserted.id },
          message: `Saved, but plan products failed: ${prodErr.message}. Add them from the page editor.`,
        };
      }
    }
  }

  revalidatePath("/dashboard/discord");
  return { ok: true, data: { id: inserted.id } };
}

// ----------------------------------------------------------------------------
// Post-purchase fulfillment — mirrors actions/telegram.issueInviteForOrder.
// Called from /api/checkout/verify-payment after a successful capture.
// Sends the invite email itself (best-effort) and returns the link.
// ----------------------------------------------------------------------------

export async function issueDiscordAccessForOrder(orderId: string): Promise<
  | { ok: true; invite_link: string }
  | { ok: false; message: string }
  | { ok: true; skipped: true }
> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, buyer_email, buyer_name, page_id, product_id, seller_user_id, discord_invite_link",
    )
    .eq("id", orderId)
    .single();
  if (!order) return { ok: false, message: "Order not found" };
  if (order.discord_invite_link) {
    return { ok: true, invite_link: order.discord_invite_link };
  }
  if (!order.page_id) return { ok: true, skipped: true };

  const { data: page } = await admin
    .from("pages")
    .select("discord_server_id")
    .eq("id", order.page_id)
    .single();
  if (!page?.discord_server_id) return { ok: true, skipped: true };

  const { data: server } = await admin
    .from("discord_servers")
    .select(
      "id, bot_token, guild_id, guild_name, invite_channel_id, access_duration_days",
    )
    .eq("id", page.discord_server_id)
    .single();
  if (!server) return { ok: true, skipped: true };
  if (!server.invite_channel_id) {
    return { ok: false, message: "Server has no invite channel configured" };
  }

  let invite;
  try {
    // 24h window for the buyer to click — single use.
    invite = await createInvite(server.bot_token, server.invite_channel_id, 60 * 24, 1);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  // Prefer the product's subscription_days (the tier the buyer picked); fall
  // back to the server's single access_duration_days for legacy single-tier.
  let tierDays: number | null = null;
  if (order.product_id) {
    const { data: prod } = await admin
      .from("products")
      .select("subscription_days")
      .eq("id", order.product_id)
      .maybeSingle();
    if (prod) tierDays = prod.subscription_days;
  }
  const durationDays = tierDays !== null ? tierDays : server.access_duration_days ?? 30;
  const expiresAt =
    durationDays && durationDays > 0
      ? new Date(Date.now() + durationDays * 86_400_000).toISOString()
      : null; // lifetime

  await admin
    .from("orders")
    .update({ discord_invite_link: invite.invite_link })
    .eq("id", orderId);

  await admin.from("discord_memberships").insert({
    discord_server_id: server.id,
    order_id: orderId,
    buyer_email: order.buyer_email,
    status: "invited",
    invited_at: new Date().toISOString(),
    expires_at: expiresAt,
    invite_code: invite.code,
    invite_link: invite.invite_link,
    bot_token_snapshot: server.bot_token,
    guild_id: server.guild_id,
  });

  // Best-effort invite email (inline — no new template catalog entry needed).
  try {
    const { sendEmail } = await import("@/lib/email");
    const serverName = server.guild_name ?? "the Discord server";
    const hi = order.buyer_name ? `Hi ${order.buyer_name},` : "Hi,";
    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <p>${hi}</p>
        <p>Thanks for your purchase. Here's your invite to <strong>${serverName}</strong>:</p>
        <p style="margin:24px 0">
          <a href="${invite.invite_link}" style="background:#5865F2;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Join the Discord server</a>
        </p>
        <p style="color:#666;font-size:13px">This invite is single-use and expires in 24 hours. If it expires before you join, reply to this email and we'll send a fresh one.</p>
      </div>`;
    await sendEmail({
      to: order.buyer_email,
      role: "buyer",
      subject: `Your invite to ${serverName}`,
      html,
      sellerId: order.seller_user_id,
    });
  } catch {
    /* email is best-effort — the link is also on the thank-you/account page */
  }

  return { ok: true, invite_link: invite.invite_link };
}

// ----------------------------------------------------------------------------
// Seller-facing member management (ownership-checked).
// ----------------------------------------------------------------------------

interface SellerMembershipCtx {
  userId: string;
  admin: ReturnType<typeof createAdminClient>;
  membership: {
    id: string;
    discord_user_id: string | null;
    status: string;
    discord_server_id: string;
  };
  botToken: string | null;
  guildId: string | null;
  serverId: string;
}

async function loadSellerMembership(
  membershipId: string,
): Promise<SellerMembershipCtx | { error: string }> {
  const actor = await requireActor("discord.manage");
  if (!actor.ok) return { error: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: m } = await admin
    .from("discord_memberships")
    .select(
      "id, discord_user_id, status, discord_server_id, guild_id, bot_token_snapshot",
    )
    .eq("id", membershipId)
    .maybeSingle();
  if (!m) return { error: "Member not found" };

  const { data: s } = await admin
    .from("discord_servers")
    .select("user_id, bot_token, guild_id")
    .eq("id", m.discord_server_id)
    .maybeSingle();
  if (!s || s.user_id !== ctx.ownerId) return { error: "Member not found" };

  return {
    userId: ctx.ownerId,
    admin,
    membership: {
      id: m.id,
      discord_user_id: m.discord_user_id,
      status: m.status,
      discord_server_id: m.discord_server_id,
    },
    botToken: (m.bot_token_snapshot as string | null) ?? s.bot_token ?? null,
    guildId: (m.guild_id as string | null) ?? s.guild_id ?? null,
    serverId: m.discord_server_id,
  };
}

/** Manually add a member to a server — mints a 7-day single-use invite. */
export async function addMemberAction(input: {
  serverId: string;
  email: string;
  durationDays?: number | null;
}): Promise<ActionResult<{ invite_link: string }>> {
  const actor = await requireActor("discord.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Enter a valid email" };
  }

  const admin = createAdminClient();
  const { data: server } = await admin
    .from("discord_servers")
    .select("id, user_id, bot_token, guild_id, invite_channel_id")
    .eq("id", input.serverId)
    .maybeSingle();
  if (!server || server.user_id !== ctx.ownerId) {
    return { ok: false, message: "Server not found" };
  }
  if (!server.bot_token || !server.invite_channel_id) {
    return { ok: false, message: "Server is not fully connected yet." };
  }

  let invite;
  try {
    invite = await createInvite(server.bot_token, server.invite_channel_id, 60 * 24 * 7, 1);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  const days = input.durationDays ?? null;
  const expiresAt =
    days && days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;

  const { error } = await admin.from("discord_memberships").insert({
    discord_server_id: server.id,
    buyer_email: email,
    status: "invited",
    invited_at: new Date().toISOString(),
    expires_at: expiresAt,
    invite_code: invite.code,
    invite_link: invite.invite_link,
    bot_token_snapshot: server.bot_token,
    guild_id: server.guild_id,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/dashboard/discord/${server.id}`);
  return { ok: true, data: { invite_link: invite.invite_link } };
}

/** Change a member's plan length. `days <= 0` = lifetime. (Re)activates. */
export async function sellerConvertPlanAction(
  membershipId: string,
  days: number,
): Promise<ActionResult> {
  const ctx = await loadSellerMembership(membershipId);
  if ("error" in ctx) return { ok: false, message: ctx.error };
  const expires =
    !days || days <= 0
      ? null
      : new Date(Date.now() + days * 86_400_000).toISOString();
  await ctx.admin
    .from("discord_memberships")
    .update({ expires_at: expires, status: "active" })
    .eq("id", membershipId);
  revalidatePath(`/dashboard/discord/${ctx.serverId}`);
  return { ok: true };
}

/** Manual join override — Discord has no join webhook, so the seller flips this
 *  once they see the buyer in the server. Optionally records their snowflake so
 *  the expiry cron can kick them. */
export async function sellerSetJoinedAction(
  membershipId: string,
  joined: boolean,
  discordUserId?: string,
): Promise<ActionResult> {
  const ctx = await loadSellerMembership(membershipId);
  if ("error" in ctx) return { ok: false, message: ctx.error };
  await ctx.admin
    .from("discord_memberships")
    .update(
      joined
        ? {
            status: "active",
            joined_at: new Date().toISOString(),
            ...(discordUserId ? { discord_user_id: discordUserId.trim() } : {}),
          }
        : { status: "invited", joined_at: null },
    )
    .eq("id", membershipId);
  revalidatePath(`/dashboard/discord/${ctx.serverId}`);
  return { ok: true };
}

/** Remove a member (kick — can rejoin on renewal). */
export async function sellerRevokeMembershipAction(
  membershipId: string,
): Promise<ActionResult> {
  const ctx = await loadSellerMembership(membershipId);
  if ("error" in ctx) return { ok: false, message: ctx.error };
  if (ctx.botToken && ctx.guildId && ctx.membership.discord_user_id) {
    try {
      await kickMember(ctx.botToken, ctx.guildId, ctx.membership.discord_user_id);
    } catch {
      /* best-effort — still mark removed */
    }
  }
  await ctx.admin
    .from("discord_memberships")
    .update({ status: "removed", removed_at: new Date().toISOString() })
    .eq("id", membershipId);
  revalidatePath(`/dashboard/discord/${ctx.serverId}`);
  return { ok: true };
}

/** Permanently ban a member (cannot rejoin until unbanned). */
export async function sellerBanMembershipAction(
  membershipId: string,
): Promise<ActionResult> {
  const ctx = await loadSellerMembership(membershipId);
  if ("error" in ctx) return { ok: false, message: ctx.error };
  if (ctx.botToken && ctx.guildId && ctx.membership.discord_user_id) {
    try {
      await banMember(ctx.botToken, ctx.guildId, ctx.membership.discord_user_id);
    } catch {
      /* best-effort — still mark banned */
    }
  }
  await ctx.admin
    .from("discord_memberships")
    .update({ status: "banned", removed_at: new Date().toISOString() })
    .eq("id", membershipId);
  revalidatePath(`/dashboard/discord/${ctx.serverId}`);
  return { ok: true };
}
