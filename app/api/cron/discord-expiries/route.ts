// POST or GET /api/cron/discord-expiries
//
// Auth: requires `x-cron-secret: $CRON_SECRET`.
//
// One pass (mirrors telegram-expiries):
//   1. 3-day reminder for memberships expiring in (3d, 2d] whose server has
//      auto_renewal_enabled.
//   2. 1-day reminder for memberships expiring in (1d, 0].
//   3. Expire + email + (best-effort) kick memberships past expires_at.
//
// NOTE: the v1 invite-link flow often has no discord_user_id (Discord has no
// join webhook), so kick is skipped for those — we still mark them expired and
// email the buyer. The OAuth2/role flow (v2) populates discord_user_id and
// closes that gap.
//
// Wire from VPS system cron:
//   0 * * * * curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" \
//             https://app.invoxai.io/api/cron/discord-expiries

import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { kickMember } from "@/lib/discord";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

interface MembershipRow {
  id: string;
  discord_server_id: string;
  discord_user_id: string | null;
  buyer_email: string;
  status: string;
  expires_at: string | null;
  reminder_3d_sent_at: string | null;
  reminder_1d_sent_at: string | null;
  bot_token_snapshot: string | null;
  guild_id: string | null;
}

interface ServerRow {
  id: string;
  bot_token: string;
  guild_id: string;
  guild_name: string | null;
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

function reminderEmail(serverName: string, daysLeft: number, renewUrl?: string) {
  const cta = renewUrl
    ? `<p style="margin:24px 0"><a href="${renewUrl}" style="background:#5865F2;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Renew access</a></p>`
    : "";
  return {
    subject: `Your access to ${serverName} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <p>Your access to <strong>${serverName}</strong> expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.</p>
      ${cta}
    </div>`,
  };
}

function expiryEmail(serverName: string, renewUrl?: string) {
  const cta = renewUrl
    ? `<p style="margin:24px 0"><a href="${renewUrl}" style="background:#5865F2;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Renew access</a></p>`
    : "";
  return {
    subject: `Your access to ${serverName} has expired`,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <p>Your access to <strong>${serverName}</strong> has ended.</p>
      ${cta}
    </div>`,
  };
}

async function run() {
  const admin = createAdminClient();
  const now = new Date();
  const in3d = new Date(now.getTime() + 3 * 86_400_000);
  const in1d = new Date(now.getTime() + 1 * 86_400_000);
  const cutoffPast = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const { data: mems } = await admin
    .from("discord_memberships")
    .select(
      "id, discord_server_id, discord_user_id, buyer_email, status, expires_at, reminder_3d_sent_at, reminder_1d_sent_at, bot_token_snapshot, guild_id",
    )
    .eq("status", "active")
    .gt("expires_at", cutoffPast);

  const list = (mems ?? []) as MembershipRow[];
  if (list.length === 0) return { ok: true, reminders: 0, expired: 0 };

  const serverIds = Array.from(new Set(list.map((m) => m.discord_server_id)));
  const { data: serversRaw } = await admin
    .from("discord_servers")
    .select(
      "id, bot_token, guild_id, guild_name, auto_renewal_enabled, page_id, pages(slug)",
    )
    .in("id", serverIds);
  const serversById = new Map<string, ServerRow>();
  for (const s of (serversRaw ?? []) as unknown as ServerRow[]) {
    serversById.set(s.id, s);
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
  let remindersSent = 0;
  let expiredCount = 0;

  for (const m of list) {
    if (!m.expires_at) continue;
    const expires = new Date(m.expires_at);
    const server = serversById.get(m.discord_server_id);
    if (!server) continue;
    const page = Array.isArray(server.pages) ? server.pages[0] : server.pages;
    const renewUrl = page ? `${base}/p/${page.slug}` : undefined;
    const serverName = server.guild_name ?? "the Discord server";

    // 3-day reminder
    if (
      server.auto_renewal_enabled &&
      !m.reminder_3d_sent_at &&
      expires <= in3d &&
      expires > in1d
    ) {
      const tpl = reminderEmail(serverName, 3, renewUrl);
      const r = await sendEmail({ to: m.buyer_email, role: "buyer", subject: tpl.subject, html: tpl.html });
      if (r.ok) {
        await admin
          .from("discord_memberships")
          .update({ reminder_3d_sent_at: now.toISOString() })
          .eq("id", m.id);
        remindersSent++;
      }
    }

    // 1-day reminder
    if (
      server.auto_renewal_enabled &&
      !m.reminder_1d_sent_at &&
      expires <= in1d &&
      expires > now
    ) {
      const tpl = reminderEmail(serverName, 1, renewUrl);
      const r = await sendEmail({ to: m.buyer_email, role: "buyer", subject: tpl.subject, html: tpl.html });
      if (r.ok) {
        await admin
          .from("discord_memberships")
          .update({ reminder_1d_sent_at: now.toISOString() })
          .eq("id", m.id);
        remindersSent++;
      }
    }

    // Expired — kick (if we know the user) + expire + email
    if (expires <= now) {
      const botToken = m.bot_token_snapshot ?? server.bot_token;
      const guildId = m.guild_id ?? server.guild_id;
      if (m.discord_user_id && botToken && guildId) {
        try {
          await kickMember(botToken, guildId, m.discord_user_id);
        } catch (e) {
          console.error("[cron] discord kick failed", m.id, e);
        }
      }

      await admin
        .from("discord_memberships")
        .update({ status: "expired", removed_at: now.toISOString() })
        .eq("id", m.id);

      const tpl = expiryEmail(serverName, renewUrl);
      await sendEmail({ to: m.buyer_email, role: "buyer", subject: tpl.subject, html: tpl.html });

      const { data: s2 } = await admin
        .from("discord_servers")
        .select("active_members")
        .eq("id", server.id)
        .single();
      await admin
        .from("discord_servers")
        .update({ active_members: Math.max(0, Number(s2?.active_members ?? 0) - 1) })
        .eq("id", server.id);

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
