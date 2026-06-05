"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/account-context";
import {
  banMember,
  generateInviteLink,
  getBotInfo,
  kickMember,
  setWebhook,
  verifyBotInGroup,
} from "@/lib/telegram";
import { writeAuditLog } from "@/lib/admin/audit";

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
  first_name: string;
  id: number;
}

/** Step 1 — validates the bot token by calling Telegram getMe. */
export async function verifyBotTokenAction(
  botToken: string,
): Promise<ActionResult<VerifiedBot>> {
  if (!botToken || !/^\d+:[A-Za-z0-9_-]+$/.test(botToken.trim())) {
    return { ok: false, message: "That doesn't look like a Telegram bot token." };
  }
  try {
    const me = await getBotInfo(botToken.trim());
    if (!me.can_join_groups) {
      return {
        ok: false,
        message: "This bot has 'Allow groups' disabled. Enable it in @BotFather → Bot Settings.",
      };
    }
    return {
      ok: true,
      data: { username: me.username, first_name: me.first_name, id: me.id },
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Step 3 — validates the group + bot admin permissions. */
export async function verifyGroupAction(
  botToken: string,
  groupId: string,
): Promise<
  ActionResult<{
    chat_id: string;
    title: string;
    bot_can_invite: boolean;
    bot_can_restrict: boolean;
  }>
> {
  try {
    const { chat, bot } = await verifyBotInGroup(botToken.trim(), groupId.trim());
    return {
      ok: true,
      data: {
        chat_id: String(chat.id),
        title: chat.title ?? "(unnamed group)",
        bot_can_invite: !!bot.can_invite_users,
        bot_can_restrict: !!bot.can_restrict_members,
      },
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ----------------------------------------------------------------------------
// Save the setup
// ----------------------------------------------------------------------------

/** One subscription tier the seller wants to offer (Weekly/Monthly/Yearly/etc).
 *  Each tier becomes one products row attached to the linked page; the public
 *  TelegramVipPage renders a picker so buyers choose which to pay for. */
export interface TelegramPlanInput {
  label: string;            // "Weekly", "Monthly", "Yearly", "Lifetime"
  duration_days: number | null; // null = lifetime
  price: number;            // INR
}

export interface SaveSetupInput {
  bot_token: string;
  bot_username?: string;
  group_id: string;
  group_chat_id: string;
  group_name?: string;
  access_duration_days: number;
  auto_renewal_enabled: boolean;
  page_id?: string;
  /** Optional list of tier plans. When provided and `page_id` is set, we
   *  insert one products row per plan attached to the page. If empty we
   *  fall back to the single-duration flow (access_duration_days). */
  plans?: TelegramPlanInput[];
}

export async function saveTelegramSetupAction(
  input: SaveSetupInput,
): Promise<ActionResult<{ id: string }>> {
  const actor = await requireActor("telegram.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();

  // Insert / upsert by (user_id, group_id).
  const row = {
    user_id: ctx.ownerId,
    page_id: input.page_id ?? null,
    bot_token: input.bot_token,
    bot_username: input.bot_username ?? null,
    group_id: input.group_id,
    group_chat_id: input.group_chat_id,
    group_name: input.group_name ?? null,
    access_duration_days: input.access_duration_days,
    auto_renewal_enabled: input.auto_renewal_enabled,
    auto_remove: true,
  };

  const { data: inserted, error } = await admin
    .from("telegram_vip_groups")
    .insert(row)
    .select("id")
    .single();
  if (error || !inserted) {
    return { ok: false, message: error?.message ?? "Insert failed" };
  }

  // Subscribe to chat_member updates for this page. We mint a per-group
  // secret token here so the webhook handler can verify deliveries — without
  // it, anyone who guesses the group_id URL can POST fake join/leave
  // events (Telegram itself does not sign webhook bodies).
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
  const webhookUrl = `${base}/api/webhooks/telegram/${inserted.id}`;
  // Telegram requires secret_token to match /^[A-Za-z0-9_-]{1,256}$/.
  const { randomBytes } = await import("node:crypto");
  const secretToken = randomBytes(32).toString("base64url");
  try {
    await setWebhook(input.bot_token, webhookUrl, secretToken);
    await admin
      .from("telegram_vip_groups")
      .update({
        webhook_set_at: new Date().toISOString(),
        webhook_secret_token: secretToken,
      })
      .eq("id", inserted.id);
  } catch (e) {
    // Non-fatal — surface in result so the wizard can show a warning.
    return {
      ok: true,
      data: { id: inserted.id },
      message: `Saved, but webhook setup failed: ${
        e instanceof Error ? e.message : String(e)
      }. You can retry from settings.`,
    };
  }

  // If linked to a page, also update pages.telegram_group_id.
  if (input.page_id) {
    await admin
      .from("pages")
      .update({ telegram_group_id: inserted.id })
      .eq("id", input.page_id)
      .eq("user_id", ctx.ownerId);

    // Create tier products if the seller defined plans. We deactivate any
    // pre-existing active products for the page so this run is the source
    // of truth (idempotent re-setup).
    const plans = (input.plans ?? []).filter(
      (p) => p.label && p.price > 0,
    );
    if (plans.length > 0) {
      await admin
        .from("products")
        .update({ active: false })
        .eq("page_id", input.page_id)
        .eq("user_id", ctx.ownerId);

      const rows = plans.map((p, idx) => ({
        user_id: ctx.ownerId,
        page_id: input.page_id,
        name: `${p.label} VIP access`,
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

  revalidatePath("/dashboard/telegram");
  return { ok: true, data: { id: inserted.id } };
}

// ----------------------------------------------------------------------------
// Admin actions — extend / revoke a membership
// ----------------------------------------------------------------------------

export async function extendMembershipAction(
  membershipId: string,
  days: number,
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return { ok: false, message: "Admin only" };

  const { data: m } = await admin
    .from("telegram_memberships")
    .select("expires_at, status")
    .eq("id", membershipId)
    .single();
  if (!m) return { ok: false, message: "Not found" };

  const base = m.expires_at && new Date(m.expires_at) > new Date()
    ? new Date(m.expires_at)
    : new Date();
  const next = new Date(base.getTime() + days * 86_400_000);

  await admin
    .from("telegram_memberships")
    .update({ expires_at: next.toISOString(), status: "active" })
    .eq("id", membershipId);

  await writeAuditLog({
    admin_id: user.id,
    action: "telegram.membership_extended",
    target_type: "telegram_membership",
    target_id: membershipId,
    details: { days },
  });

  revalidatePath("/admin/telegram");
  return { ok: true };
}

export async function revokeMembershipAction(
  membershipId: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return { ok: false, message: "Admin only" };

  const { data: m } = await admin
    .from("telegram_memberships")
    .select("telegram_user_id, bot_token_snapshot, group_chat_id, telegram_group_id")
    .eq("id", membershipId)
    .single();
  if (!m) return { ok: false, message: "Not found" };

  // Resolve bot token + chat id (fall back to the live group config).
  let botToken = m.bot_token_snapshot as string | null;
  let chatId = m.group_chat_id as string | null;
  if (!botToken || !chatId) {
    const { data: g } = await admin
      .from("telegram_vip_groups")
      .select("bot_token, group_chat_id, group_id")
      .eq("id", m.telegram_group_id)
      .single();
    botToken = botToken ?? g?.bot_token ?? null;
    chatId = chatId ?? g?.group_chat_id ?? g?.group_id ?? null;
  }

  if (botToken && chatId && m.telegram_user_id) {
    try {
      await kickMember(botToken, chatId, Number(m.telegram_user_id));
    } catch {
      /* best-effort — still mark removed */
    }
  }

  await admin
    .from("telegram_memberships")
    .update({
      status: "removed",
      removed_at: new Date().toISOString(),
    })
    .eq("id", membershipId);

  await writeAuditLog({
    admin_id: user.id,
    action: "telegram.membership_revoked",
    target_type: "telegram_membership",
    target_id: membershipId,
  });

  revalidatePath("/admin/telegram");
  return { ok: true };
}

// Helper used by /api/checkout/verify-payment after a successful capture.
// Lives here so the test / cron / route handlers all share one entry point.
export async function issueInviteForOrder(orderId: string): Promise<
  | { ok: true; invite_link: string }
  | { ok: false; message: string }
  | { ok: true; skipped: true }
> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, buyer_email, buyer_name, page_id, product_id, seller_user_id, telegram_invite_link",
    )
    .eq("id", orderId)
    .single();
  if (!order) return { ok: false, message: "Order not found" };
  if (order.telegram_invite_link) {
    return { ok: true, invite_link: order.telegram_invite_link };
  }
  if (!order.page_id) return { ok: true, skipped: true };

  const { data: page } = await admin
    .from("pages")
    .select("telegram_group_id")
    .eq("id", order.page_id)
    .single();
  if (!page?.telegram_group_id) return { ok: true, skipped: true };

  const { data: group } = await admin
    .from("telegram_vip_groups")
    .select(
      "id, bot_token, group_chat_id, group_id, group_name, access_duration_days",
    )
    .eq("id", page.telegram_group_id)
    .single();
  if (!group) return { ok: true, skipped: true };

  const chatId = group.group_chat_id ?? group.group_id;
  if (!chatId) return { ok: false, message: "Group has no chat id stored" };

  let invite;
  try {
    invite = await generateInviteLink(
      group.bot_token,
      chatId,
      10,
      `invoxai-${orderId.slice(0, 8)}`,
    );
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  // Prefer the product's subscription_days (set by the tier the buyer
  // picked — e.g. Monthly=30, Yearly=365, Lifetime=null). Fall back to the
  // group's single access_duration_days for legacy single-tier setups.
  let tierDays: number | null = null;
  if (order.product_id) {
    const { data: prod } = await admin
      .from("products")
      .select("subscription_days")
      .eq("id", order.product_id)
      .maybeSingle();
    if (prod) tierDays = prod.subscription_days;
  }
  const durationDays =
    tierDays !== null
      ? tierDays
      : (group.access_duration_days ?? 30);
  const expiresAt =
    durationDays && durationDays > 0
      ? new Date(Date.now() + durationDays * 86_400_000).toISOString()
      : null; // lifetime

  await admin
    .from("orders")
    .update({ telegram_invite_link: invite.invite_link })
    .eq("id", orderId);

  await admin.from("telegram_memberships").insert({
    telegram_group_id: group.id,
    order_id: orderId,
    buyer_email: order.buyer_email,
    status: "invited",
    invited_at: new Date().toISOString(),
    expires_at: expiresAt,
    invite_link: invite.invite_link,
    bot_token_snapshot: group.bot_token,
    group_chat_id: String(chatId),
  });

  return { ok: true, invite_link: invite.invite_link };
}

// ----------------------------------------------------------------------------
// Seller-facing member management (add / regenerate invite)
// ----------------------------------------------------------------------------

/** Manually add a member to a channel — mints a 7-day one-time invite link. */
export async function addMemberAction(input: {
  groupId: string;
  email: string;
  durationDays?: number | null;
}): Promise<ActionResult<{ invite_link: string }>> {
  const actor = await requireActor("telegram.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Enter a valid email" };
  }

  const admin = createAdminClient();
  const { data: group } = await admin
    .from("telegram_vip_groups")
    .select("id, user_id, bot_token, group_chat_id, group_id")
    .eq("id", input.groupId)
    .maybeSingle();
  if (!group || group.user_id !== ctx.ownerId) {
    return { ok: false, message: "Channel not found" };
  }
  const chatId = group.group_chat_id ?? group.group_id;
  if (!group.bot_token || !chatId) {
    return { ok: false, message: "Channel is not fully connected yet." };
  }

  let invite;
  try {
    invite = await generateInviteLink(group.bot_token, chatId, 60 * 24 * 7, `manual`);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  const days = input.durationDays ?? null;
  const expiresAt =
    days && days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;

  const { error } = await admin.from("telegram_memberships").insert({
    telegram_group_id: group.id,
    buyer_email: email,
    status: "invited",
    invited_at: new Date().toISOString(),
    expires_at: expiresAt,
    invite_link: invite.invite_link,
    bot_token_snapshot: group.bot_token,
    group_chat_id: String(chatId),
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/dashboard/telegram/${group.id}`);
  return { ok: true, data: { invite_link: invite.invite_link } };
}

/** Regenerate a member's one-time invite link (7-day validity). */
export async function regenerateMemberInviteAction(
  membershipId: string,
): Promise<ActionResult<{ invite_link: string }>> {
  const actor = await requireActor("telegram.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: mem } = await admin
    .from("telegram_memberships")
    .select("id, telegram_group_id, group_chat_id, bot_token_snapshot")
    .eq("id", membershipId)
    .maybeSingle();
  if (!mem) return { ok: false, message: "Member not found" };

  const { data: group } = await admin
    .from("telegram_vip_groups")
    .select("id, user_id, bot_token, group_chat_id, group_id")
    .eq("id", mem.telegram_group_id)
    .maybeSingle();
  if (!group || group.user_id !== ctx.ownerId) {
    return { ok: false, message: "Member not found" };
  }

  const botToken = mem.bot_token_snapshot ?? group.bot_token;
  const chatId = mem.group_chat_id ?? group.group_chat_id ?? group.group_id;
  if (!botToken || !chatId) {
    return { ok: false, message: "Channel is not fully connected yet." };
  }

  let invite;
  try {
    invite = await generateInviteLink(botToken, chatId, 60 * 24 * 7, `regen`);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }

  await admin
    .from("telegram_memberships")
    .update({ invite_link: invite.invite_link })
    .eq("id", membershipId);

  revalidatePath(`/dashboard/telegram/${group.id}`);
  return { ok: true, data: { invite_link: invite.invite_link } };
}

// ----------------------------------------------------------------------------
// Seller member management (ownership-checked — vs the admin-only versions
// above). Powers the Members tab: Convert plan / Mark joined / Revoke / Ban.
// ----------------------------------------------------------------------------

interface SellerMembershipCtx {
  userId: string;
  admin: ReturnType<typeof createAdminClient>;
  membership: {
    id: string;
    telegram_user_id: string | null;
    status: string;
    telegram_group_id: string;
  };
  botToken: string | null;
  chatId: string | null;
  groupId: string;
}

/** Load a membership and verify the current user owns its channel. */
async function loadSellerMembership(
  membershipId: string,
): Promise<SellerMembershipCtx | { error: string }> {
  const actor = await requireActor("telegram.manage");
  if (!actor.ok) return { error: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: m } = await admin
    .from("telegram_memberships")
    .select("id, telegram_user_id, status, telegram_group_id, group_chat_id, bot_token_snapshot")
    .eq("id", membershipId)
    .maybeSingle();
  if (!m) return { error: "Member not found" };

  const { data: g } = await admin
    .from("telegram_vip_groups")
    .select("user_id, bot_token, group_chat_id, group_id")
    .eq("id", m.telegram_group_id)
    .maybeSingle();
  if (!g || g.user_id !== ctx.ownerId) return { error: "Member not found" };

  return {
    userId: ctx.ownerId,
    admin,
    membership: {
      id: m.id,
      telegram_user_id: m.telegram_user_id,
      status: m.status,
      telegram_group_id: m.telegram_group_id,
    },
    botToken: (m.bot_token_snapshot as string | null) ?? g.bot_token ?? null,
    chatId:
      (m.group_chat_id as string | null) ?? g.group_chat_id ?? g.group_id ?? null,
    groupId: m.telegram_group_id,
  };
}

/** Change a member's plan length. `days <= 0` = lifetime. Sets a fresh term
 *  from now and (re)activates the membership. */
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
    .from("telegram_memberships")
    .update({ expires_at: expires, status: "active" })
    .eq("id", membershipId);
  revalidatePath(`/dashboard/telegram/${ctx.groupId}`);
  return { ok: true };
}

/** Manual join-status override — instant fix when the webhook missed a join
 *  (the seller can see the person is in the channel). */
export async function sellerSetJoinedAction(
  membershipId: string,
  joined: boolean,
): Promise<ActionResult> {
  const ctx = await loadSellerMembership(membershipId);
  if ("error" in ctx) return { ok: false, message: ctx.error };
  await ctx.admin
    .from("telegram_memberships")
    .update(
      joined
        ? { status: "active", joined_at: new Date().toISOString() }
        : { status: "invited", joined_at: null },
    )
    .eq("id", membershipId);
  revalidatePath(`/dashboard/telegram/${ctx.groupId}`);
  return { ok: true };
}

/** Remove a member (kick — can rejoin on renewal). */
export async function sellerRevokeMembershipAction(
  membershipId: string,
): Promise<ActionResult> {
  const ctx = await loadSellerMembership(membershipId);
  if ("error" in ctx) return { ok: false, message: ctx.error };
  if (ctx.botToken && ctx.chatId && ctx.membership.telegram_user_id) {
    try {
      await kickMember(ctx.botToken, ctx.chatId, Number(ctx.membership.telegram_user_id));
    } catch {
      /* best-effort — still mark removed */
    }
  }
  await ctx.admin
    .from("telegram_memberships")
    .update({ status: "removed", removed_at: new Date().toISOString() })
    .eq("id", membershipId);
  revalidatePath(`/dashboard/telegram/${ctx.groupId}`);
  return { ok: true };
}

/** Permanently ban a member (cannot rejoin until unbanned). */
export async function sellerBanMembershipAction(
  membershipId: string,
): Promise<ActionResult> {
  const ctx = await loadSellerMembership(membershipId);
  if ("error" in ctx) return { ok: false, message: ctx.error };
  if (ctx.botToken && ctx.chatId && ctx.membership.telegram_user_id) {
    try {
      await banMember(ctx.botToken, ctx.chatId, Number(ctx.membership.telegram_user_id));
    } catch {
      /* best-effort — still mark banned */
    }
  }
  await ctx.admin
    .from("telegram_memberships")
    .update({ status: "banned", removed_at: new Date().toISOString() })
    .eq("id", membershipId);
  revalidatePath(`/dashboard/telegram/${ctx.groupId}`);
  return { ok: true };
}
