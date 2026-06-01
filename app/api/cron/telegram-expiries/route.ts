// POST or GET /api/cron/telegram-expiries
//
// Auth: requires `x-cron-secret: $CRON_SECRET`.
//
// One pass:
//   1. Send 3-day reminder for memberships expiring in (3d, 2d] that have a
//      seller with auto_renewal_enabled.
//   2. Send 1-day reminder for memberships expiring in (1d, 0] same conditions.
//   3. Kick + email expired memberships (expires_at < now AND status = active).
//
// Wire from VPS system cron:
//   0 * * * * curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" \
//             https://app.invoxai.io/api/cron/telegram-expiries

import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { kickMember } from "@/lib/telegram";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/emails/render";

export const dynamic = "force-dynamic";

interface MembershipRow {
  id: string;
  telegram_group_id: string;
  telegram_user_id: string | null;
  buyer_email: string;
  status: string;
  invited_at: string | null;
  joined_at: string | null;
  expires_at: string | null;
  reminder_3d_sent_at: string | null;
  reminder_1d_sent_at: string | null;
  bot_token_snapshot: string | null;
  group_chat_id: string | null;
  order_id: string | null;
}

interface GroupRow {
  id: string;
  bot_token: string;
  group_chat_id: string | null;
  group_id: string;
  group_name: string | null;
  auto_renewal_enabled: boolean | null;
  page_id: string | null;
  pages?: { slug: string } | { slug: string }[] | null;
}

function authed(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided = req.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function run() {
  const admin = createAdminClient();
  const now = new Date();
  const in3d = new Date(now.getTime() + 3 * 86_400_000);
  const in1d = new Date(now.getTime() + 1 * 86_400_000);

  // Pull a generous window of soon-expiring + just-expired active memberships
  const cutoffPast = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const { data: mems } = await admin
    .from("telegram_memberships")
    .select(
      "id, telegram_group_id, telegram_user_id, buyer_email, status, invited_at, joined_at, expires_at, reminder_3d_sent_at, reminder_1d_sent_at, bot_token_snapshot, group_chat_id, order_id",
    )
    .eq("status", "active")
    .gt("expires_at", cutoffPast);

  const list = (mems ?? []) as MembershipRow[];
  if (list.length === 0) {
    return { ok: true, reminders: 0, expired: 0 };
  }

  const groupIds = Array.from(new Set(list.map((m) => m.telegram_group_id)));
  const { data: groupsRaw } = await admin
    .from("telegram_vip_groups")
    .select(
      "id, bot_token, group_chat_id, group_id, group_name, auto_renewal_enabled, page_id, pages(slug)",
    )
    .in("id", groupIds);
  const groupsById = new Map<string, GroupRow>();
  for (const g of (groupsRaw ?? []) as unknown as GroupRow[]) {
    groupsById.set(g.id, g);
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";

  let remindersSent = 0;
  let expiredCount = 0;

  for (const m of list) {
    if (!m.expires_at) continue;
    const expires = new Date(m.expires_at);
    const group = groupsById.get(m.telegram_group_id);
    if (!group) continue;
    const page = Array.isArray(group.pages) ? group.pages[0] : group.pages;
    const renewUrl = page ? `${base}/p/${page.slug}` : undefined;

    // 3-day reminder
    if (
      group.auto_renewal_enabled &&
      !m.reminder_3d_sent_at &&
      expires <= in3d &&
      expires > in1d
    ) {
      const tpl = await renderEmail("telegram_reminder", {
        groupName: group.group_name ?? undefined,
        daysLeft: 3,
        renewUrl,
      });
      const r = await sendEmail({ to: m.buyer_email, role: "buyer", subject: tpl.subject, html: tpl.html });
      if (r.ok) {
        await admin
          .from("telegram_memberships")
          .update({ reminder_3d_sent_at: now.toISOString() })
          .eq("id", m.id);
        remindersSent++;
      }
    }

    // 1-day reminder
    if (
      group.auto_renewal_enabled &&
      !m.reminder_1d_sent_at &&
      expires <= in1d &&
      expires > now
    ) {
      const tpl = await renderEmail("telegram_reminder", {
        groupName: group.group_name ?? undefined,
        daysLeft: 1,
        renewUrl,
      });
      const r = await sendEmail({ to: m.buyer_email, role: "buyer", subject: tpl.subject, html: tpl.html });
      if (r.ok) {
        await admin
          .from("telegram_memberships")
          .update({ reminder_1d_sent_at: now.toISOString() })
          .eq("id", m.id);
        remindersSent++;
      }
    }

    // Expired — kick + expire + email
    if (expires <= now) {
      const botToken = m.bot_token_snapshot ?? group.bot_token;
      const chatId = m.group_chat_id ?? group.group_chat_id ?? group.group_id;

      if (m.telegram_user_id && botToken && chatId) {
        try {
          await kickMember(botToken, chatId, Number(m.telegram_user_id));
        } catch (e) {
          console.error("[cron] kick failed", m.id, e);
        }
      }

      await admin
        .from("telegram_memberships")
        .update({ status: "expired", removed_at: now.toISOString() })
        .eq("id", m.id);

      const tpl = await renderEmail("telegram_expiry", {
        groupName: group.group_name ?? undefined,
        renewUrl,
      });
      await sendEmail({ to: m.buyer_email, role: "buyer", subject: tpl.subject, html: tpl.html });

      // Decrement active_members.
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

      expiredCount++;
    }
  }

  return { ok: true, reminders: remindersSent, expired: expiredCount };
}

export async function POST(request: Request) {
  if (!authed(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await run());
}

export async function GET(request: Request) {
  if (!authed(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await run());
}
