"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
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

export interface SaveSetupInput {
  bot_token: string;
  bot_username?: string;
  group_id: string;
  group_chat_id: string;
  group_name?: string;
  access_duration_days: number;
  auto_renewal_enabled: boolean;
  page_id?: string;
}

export async function saveTelegramSetupAction(
  input: SaveSetupInput,
): Promise<ActionResult<{ id: string }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();

  // Insert / upsert by (user_id, group_id).
  const row = {
    user_id: user.id,
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

  // Subscribe to chat_member updates for this page.
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
  const webhookUrl = `${base}/api/webhooks/telegram/${inserted.id}`;
  try {
    await setWebhook(input.bot_token, webhookUrl);
    await admin
      .from("telegram_vip_groups")
      .update({ webhook_set_at: new Date().toISOString() })
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
      .eq("user_id", user.id);
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
      "id, buyer_email, buyer_name, page_id, seller_user_id, telegram_invite_link",
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

  const durationDays = group.access_duration_days ?? 30;
  const expiresAt =
    durationDays > 0
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
    bot_token_snapshot: group.bot_token,
    group_chat_id: String(chatId),
  });

  return { ok: true, invite_link: invite.invite_link };
}
