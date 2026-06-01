// POST /api/webhooks/telegram/{telegram_vip_groups.id}
//
// Telegram delivers chat_member / my_chat_member updates here. We only care
// about a buyer transitioning from non-member → member (i.e. they used the
// one-time invite link we minted on payment). We bind their telegram_user_id
// to the most recent `invited` membership row for the same group within a
// 30-min window — that's our best signal that this user is "the buyer".

import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyTelegramJoin } from "@/lib/notifications/events";

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  username?: string;
  first_name?: string;
}

interface ChatMember {
  user: TelegramUser;
  status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";
}

interface ChatMemberUpdate {
  chat: { id: number; title?: string };
  from: TelegramUser;
  date: number;
  old_chat_member: ChatMember;
  new_chat_member: ChatMember;
  invite_link?: { invite_link: string };
}

interface TelegramUpdate {
  update_id: number;
  chat_member?: ChatMemberUpdate;
  my_chat_member?: ChatMemberUpdate;
}

const JOIN_STATUSES: ChatMember["status"][] = ["member", "administrator", "creator"];
const LEAVE_STATUSES: ChatMember["status"][] = ["left", "kicked"];

export async function POST(
  request: Request,
  { params }: { params: { group_id: string } },
) {
  const admin = createAdminClient();

  // Resolve the group + its stored secret token BEFORE parsing the body so
  // an attacker can't churn DB lookups by spamming bad JSON. Telegram does
  // not sign webhook bodies — the only auth signal is the
  // `X-Telegram-Bot-Api-Secret-Token` header it echoes back to us, which
  // we minted server-side in saveTelegramSetupAction.
  const { data: group } = await admin
    .from("telegram_vip_groups")
    .select("id, group_chat_id, group_id, user_id, webhook_secret_token")
    .eq("id", params.group_id)
    .single();
  if (!group) {
    return NextResponse.json({ ok: true, skipped: "unknown group" });
  }

  const presented =
    request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const expected = group.webhook_secret_token ?? "";
  // Reject if we never recorded a secret (group set up before this fix —
  // re-run the wizard to rotate) or if the presented one doesn't match.
  if (
    !expected ||
    presented.length !== expected.length ||
    !timingSafeStringEqual(presented, expected)
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: TelegramUpdate;
  try {
    body = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true, error: "bad json" });
  }

  const evt = body.chat_member ?? body.my_chat_member;
  if (!evt || evt.new_chat_member.user.is_bot) {
    return NextResponse.json({ ok: true, skipped: "no relevant event" });
  }

  const tgUserId = String(evt.new_chat_member.user.id);
  const oldStatus = evt.old_chat_member.status;
  const newStatus = evt.new_chat_member.status;

  const joined =
    !JOIN_STATUSES.includes(oldStatus) && JOIN_STATUSES.includes(newStatus);
  const left =
    JOIN_STATUSES.includes(oldStatus) && LEAVE_STATUSES.includes(newStatus);

  if (joined) {
    // Bind the joining user to their invited membership. Prefer matching on
    // the exact one-time invite_link they used (reliable, time-independent);
    // fall back to the most recent still-invited row (7-day window).
    const usedLink = evt.invite_link?.invite_link;
    let pendingId: string | undefined;

    if (usedLink) {
      const { data: byLink } = await admin
        .from("telegram_memberships")
        .select("id")
        .eq("telegram_group_id", group.id)
        .eq("invite_link", usedLink)
        .order("invited_at", { ascending: false })
        .limit(1);
      pendingId = byLink?.[0]?.id;
    }

    if (!pendingId) {
      const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data: pending } = await admin
        .from("telegram_memberships")
        .select("id")
        .eq("telegram_group_id", group.id)
        .eq("status", "invited")
        .is("telegram_user_id", null)
        .gte("invited_at", cutoff)
        .order("invited_at", { ascending: false })
        .limit(1);
      pendingId = pending?.[0]?.id;
    }

    if (pendingId) {
      await admin
        .from("telegram_memberships")
        .update({
          telegram_user_id: tgUserId,
          status: "active",
          joined_at: new Date().toISOString(),
        })
        .eq("id", pendingId);
    } else {
      // No pending invite — still record the join so admins can see who's in.
      await admin.from("telegram_memberships").insert({
        telegram_group_id: group.id,
        telegram_user_id: tgUserId,
        buyer_email: evt.new_chat_member.user.username
          ? `@${evt.new_chat_member.user.username}`
          : "(unknown)",
        status: "active",
        joined_at: new Date().toISOString(),
      });
    }

    // Bump active_members.
    const { data: g2 } = await admin
      .from("telegram_vip_groups")
      .select("active_members")
      .eq("id", group.id)
      .single();
    await admin
      .from("telegram_vip_groups")
      .update({ active_members: Number(g2?.active_members ?? 0) + 1 })
      .eq("id", group.id);

    // In-app bell — seller + admins. Best-effort.
    await notifyTelegramJoin(
      {
        groupId: group.id,
        sellerId: group.user_id,
        buyerLabel: evt.new_chat_member.user.username
          ? `@${evt.new_chat_member.user.username}`
          : evt.new_chat_member.user.first_name ?? null,
      },
      admin,
    );

    return NextResponse.json({ ok: true, event: "joined" });
  }

  if (left) {
    await admin
      .from("telegram_memberships")
      .update({ status: "removed", removed_at: new Date().toISOString() })
      .eq("telegram_group_id", group.id)
      .eq("telegram_user_id", tgUserId)
      .in("status", ["active", "invited"]);

    const { data: g2 } = await admin
      .from("telegram_vip_groups")
      .select("active_members")
      .eq("id", group.id)
      .single();
    await admin
      .from("telegram_vip_groups")
      .update({
        active_members: Math.max(0, Number(g2?.active_members ?? 0) - 1),
      })
      .eq("id", group.id);

    return NextResponse.json({ ok: true, event: "left" });
  }

  return NextResponse.json({ ok: true, event: "ignored" });
}
