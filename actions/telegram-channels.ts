"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { setWebhook } from "@/lib/telegram";
import { slugify } from "@/lib/templates/utils";

export interface ActionResult<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";

async function authUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// ── Connection status ───────────────────────────────────────────────────────

export async function getTelegramConnectionAction(): Promise<
  ActionResult<{
    connected: boolean;
    telegramUser?: { username?: string; name: string; phone: string };
  }>
> {
  const user = await authUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  const { data } = await admin
    .from("telegram_user_sessions")
    .select("telegram_username, telegram_name, telegram_phone")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return { ok: true, data: { connected: false } };
  return {
    ok: true,
    data: {
      connected: true,
      telegramUser: {
        username: data.telegram_username ?? undefined,
        name: data.telegram_name ?? "",
        phone: data.telegram_phone ?? "",
      },
    },
  };
}

// ── Save the selected/created channel (after bot was added) ──────────────────

export async function saveChannelSetupAction(data: {
  chatId: string;
  chatTitle: string;
  channelType: "channel" | "supergroup" | "group";
  chatUsername?: string;
  memberCount?: number;
}): Promise<ActionResult<{ groupDbId: string }>> {
  const user = await authUser();
  if (!user) return { ok: false, message: "Not signed in" };
  if (!BOT_TOKEN) return { ok: false, message: "Platform bot token not configured." };

  const admin = createAdminClient();

  // Upsert by (user_id, telegram_chat_id) so re-running setup is idempotent.
  const numericChatId = Number(data.chatId);
  const { data: existing } = await admin
    .from("telegram_vip_groups")
    .select("id")
    .eq("user_id", user.id)
    .eq("telegram_chat_id", numericChatId)
    .maybeSingle();

  const row = {
    user_id: user.id,
    group_id: data.chatId,
    group_name: data.chatTitle,
    telegram_chat_id: numericChatId,
    channel_type: data.channelType,
    channel_username: data.chatUsername ?? null,
    total_member_count: data.memberCount ?? 0,
    bot_token: BOT_TOKEN,
    bot_username: BOT_USERNAME || null,
    setup_complete: false,
  };

  let groupDbId: string;
  if (existing) {
    await admin.from("telegram_vip_groups").update(row).eq("id", existing.id);
    groupDbId = existing.id;
  } else {
    const { data: inserted, error } = await admin
      .from("telegram_vip_groups")
      .insert(row)
      .select("id")
      .single();
    if (error || !inserted) {
      return { ok: false, message: error?.message ?? "Insert failed" };
    }
    groupDbId = inserted.id;
  }

  // Point the platform bot's webhook at this group (per-group secret token).
  const { randomBytes } = await import("node:crypto");
  const secretToken = randomBytes(32).toString("base64url");
  const webhookUrl = `${APP_URL}/api/webhooks/telegram/${groupDbId}`;
  try {
    await setWebhook(BOT_TOKEN, webhookUrl, secretToken);
    await admin
      .from("telegram_vip_groups")
      .update({
        webhook_set_at: new Date().toISOString(),
        webhook_secret_token: secretToken,
      })
      .eq("id", groupDbId);
  } catch (e) {
    return {
      ok: true,
      data: { groupDbId },
      message: `Saved, but webhook setup failed: ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }

  return { ok: true, data: { groupDbId } };
}

// ── Save page details (step 3 of the wizard) ─────────────────────────────────

export async function saveChannelPageAction(data: {
  groupDbId: string;
  pageName: string;
  pageDescription: string;
  category: string;
  logoUrl?: string;
  registrationQuestions?: string[];
}): Promise<ActionResult> {
  const user = await authUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("telegram_vip_groups")
    .update({
      page_name: data.pageName,
      page_description: data.pageDescription,
      category: data.category,
      logo_url: data.logoUrl ?? null,
      registration_questions: data.registrationQuestions ?? [],
    })
    .eq("id", data.groupDbId)
    .eq("user_id", user.id);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// ── Publish: create plans + products + the public page ───────────────────────

export interface PublishPlanInput {
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  durationDays: number;
  durationLabel: string;
  isPopular: boolean;
  sortOrder: number;
}

async function findFreeSlug(base: string): Promise<string> {
  const admin = createAdminClient();
  const seed = slugify(base) || `channel-${nanoid(6).toLowerCase()}`;
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? seed : `${seed}-${nanoid(4).toLowerCase()}`;
    const { data } = await admin
      .from("pages")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${seed}-${nanoid(8).toLowerCase()}`;
}

export async function publishChannelAction(data: {
  groupDbId: string;
  plans: PublishPlanInput[];
  autoRenewal: boolean;
}): Promise<ActionResult<{ slug: string; pageUrl: string }>> {
  const user = await authUser();
  if (!user) return { ok: false, message: "Not signed in" };
  if (!data.plans.length) return { ok: false, message: "Add at least one plan." };

  const admin = createAdminClient();

  const { data: group } = await admin
    .from("telegram_vip_groups")
    .select(
      "id, user_id, group_name, page_name, page_description, category, logo_url, channel_type, channel_username, total_member_count, auto_page_id",
    )
    .eq("id", data.groupDbId)
    .maybeSingle();
  if (!group || group.user_id !== user.id) {
    return { ok: false, message: "Channel not found" };
  }

  const pageName = group.page_name || group.group_name || "VIP Channel";

  // 1. Resolve the page row (reuse auto_page_id on re-publish, else create).
  let pageId = group.auto_page_id as string | null;
  let slug: string;

  const pageConfig = {
    group_id: group.id,
    group_name: pageName,
    group_avatar: group.logo_url ?? undefined,
    channel_type: group.channel_type,
    channel_username: group.channel_username,
    active_members: group.total_member_count ?? 0,
    description: group.page_description ?? "",
    category: group.category ?? "General",
    auto_renewal: data.autoRenewal,
  };

  if (pageId) {
    const { data: existingPage } = await admin
      .from("pages")
      .select("slug")
      .eq("id", pageId)
      .maybeSingle();
    slug = existingPage?.slug ?? (await findFreeSlug(pageName));
    await admin
      .from("pages")
      .update({
        title: pageName,
        page_config: pageConfig,
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", pageId);
  } else {
    slug = await findFreeSlug(pageName);
    const { data: newPage, error: pageErr } = await admin
      .from("pages")
      .insert({
        user_id: user.id,
        title: pageName,
        slug,
        type: "payment",
        status: "published",
        template_id: "telegram-vip",
        page_config: pageConfig,
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (pageErr || !newPage) {
      return { ok: false, message: pageErr?.message ?? "Page creation failed" };
    }
    pageId = newPage.id;
  }

  // 2. Reset previous plans/products for an idempotent re-publish.
  await admin
    .from("products")
    .update({ active: false })
    .eq("page_id", pageId)
    .eq("user_id", user.id);
  await admin
    .from("telegram_subscription_plans")
    .delete()
    .eq("group_id", group.id);

  // 3. Create one product + one plan row per tier.
  const sorted = [...data.plans].sort((a, b) => a.sortOrder - b.sortOrder);
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]!;
    const { data: product, error: prodErr } = await admin
      .from("products")
      .insert({
        user_id: user.id,
        page_id: pageId,
        name: `${p.name} — ${pageName}`,
        display_label: p.name,
        price: p.price,
        currency: "INR",
        type: "one_time",
        subscription_days: p.durationDays === 0 ? null : p.durationDays,
        sort_order: i,
        active: true,
      })
      .select("id")
      .single();
    if (prodErr || !product) {
      return { ok: false, message: prodErr?.message ?? "Product creation failed" };
    }
    await admin.from("telegram_subscription_plans").insert({
      group_id: group.id,
      user_id: user.id,
      name: p.name,
      description: p.description ?? null,
      price: p.price,
      original_price: p.originalPrice ?? null,
      duration_days: p.durationDays,
      duration_label: p.durationLabel,
      is_popular: p.isPopular,
      sort_order: i,
      active: true,
      product_id: product.id,
    });
  }

  // 4. Mark the group live + linked.
  await admin
    .from("telegram_vip_groups")
    .update({
      auto_page_id: pageId,
      page_id: pageId,
      page_name: pageName,
      auto_renewal_enabled: data.autoRenewal,
      setup_complete: true,
    })
    .eq("id", group.id);

  revalidatePath("/dashboard/telegram");
  return { ok: true, data: { slug, pageUrl: `${APP_URL}/p/${slug}` } };
}

// ── Dashboard data ────────────────────────────────────────────────────────

export interface ChannelDashboardData {
  group: {
    id: string;
    group_name: string | null;
    channel_type: string | null;
    channel_username: string | null;
    logo_url: string | null;
    setup_complete: boolean | null;
    slug: string | null;
    pageUrl: string | null;
  };
  plans: Array<{
    id: string;
    name: string;
    price: number;
    duration_label: string;
    subscriber_count: number;
    revenue: number;
  }>;
  stats: {
    totalPageViews: number;
    totalSales: number;
    totalSubscriptions: number;
    activeMembers: number;
    churnRate: number;
    recentTransactions: Array<{
      buyer_email: string;
      plan: string | null;
      amount: number;
      created_at: string;
    }>;
    topMembers: Array<{ buyer_email: string; amount: number; joined_at: string | null }>;
    salesByDay: Array<{ date: string; amount: number; count: number }>;
    membersByPlan: Array<{ plan_name: string; count: number; revenue: number }>;
  };
}

export async function getChannelDashboardAction(
  groupId: string,
): Promise<ActionResult<ChannelDashboardData>> {
  const user = await authUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  const { data: group } = await admin
    .from("telegram_vip_groups")
    .select(
      "id, user_id, group_name, channel_type, channel_username, logo_url, setup_complete, total_page_views, auto_page_id, page_id",
    )
    .eq("id", groupId)
    .maybeSingle();
  if (!group || group.user_id !== user.id) {
    return { ok: false, message: "Channel not found" };
  }

  const pageId = (group.auto_page_id ?? group.page_id) as string | null;

  const [
    { data: pageRow },
    { data: plansRaw },
    { data: memsRaw },
    { count: viewCount },
  ] = await Promise.all([
    pageId
      ? admin.from("pages").select("slug").eq("id", pageId).maybeSingle()
      : Promise.resolve({ data: null } as { data: { slug: string } | null }),
    admin
      .from("telegram_subscription_plans")
      .select("id, name, price, duration_label, subscriber_count, product_id")
      .eq("group_id", groupId)
      .order("sort_order", { ascending: true }),
    admin
      .from("telegram_memberships")
      .select("buyer_email, status, joined_at, expires_at, removed_at, plan_name, order_id")
      .eq("telegram_group_id", groupId),
    admin
      .from("telegram_group_views")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId),
  ]);

  const mems = (memsRaw ?? []) as Array<{
    buyer_email: string;
    status: string;
    joined_at: string | null;
    expires_at: string | null;
    removed_at: string | null;
    plan_name: string | null;
    order_id: string | null;
  }>;

  // Orders that funded these memberships → revenue + recent transactions.
  const orderIds = Array.from(
    new Set(mems.map((m) => m.order_id).filter(Boolean)),
  ) as string[];
  let orders: Array<{
    id: string;
    amount: number;
    status: string;
    buyer_email: string;
    created_at: string;
  }> = [];
  if (orderIds.length) {
    const { data: ordersRaw } = await admin
      .from("orders")
      .select("id, amount, status, buyer_email, created_at")
      .in("id", orderIds);
    orders = (ordersRaw ?? []) as typeof orders;
  }
  const paid = orders.filter((o) => o.status === "paid");
  const paidById = new Map(paid.map((o) => [o.id, o]));

  const totalSales = paid.reduce((a, o) => a + Number(o.amount ?? 0), 0);
  const activeMembers = mems.filter((m) => m.status === "active").length;

  // Churn over the last 30 days.
  const cutoff = Date.now() - 30 * 86_400_000;
  const removed30 = mems.filter(
    (m) => m.removed_at && new Date(m.removed_at).getTime() >= cutoff,
  ).length;
  const churnDenom = activeMembers + removed30;
  const churnRate = churnDenom > 0 ? Math.round((removed30 / churnDenom) * 100) : 0;

  // Sales by day (last 30 days).
  const byDay = new Map<string, { amount: number; count: number }>();
  for (const o of paid) {
    const day = o.created_at.slice(0, 10);
    const cur = byDay.get(day) ?? { amount: 0, count: 0 };
    cur.amount += Number(o.amount ?? 0);
    cur.count += 1;
    byDay.set(day, cur);
  }
  const salesByDay = Array.from(byDay.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top members by amount paid.
  const memByEmail = new Map<string, { amount: number; joined_at: string | null }>();
  for (const m of mems) {
    const ord = m.order_id ? paidById.get(m.order_id) : undefined;
    const amt = ord ? Number(ord.amount ?? 0) : 0;
    const cur = memByEmail.get(m.buyer_email) ?? { amount: 0, joined_at: m.joined_at };
    cur.amount += amt;
    memByEmail.set(m.buyer_email, cur);
  }
  const topMembers = Array.from(memByEmail.entries())
    .map(([buyer_email, v]) => ({ buyer_email, amount: v.amount, joined_at: v.joined_at }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Members + revenue by plan.
  const byPlan = new Map<string, { count: number; revenue: number }>();
  for (const m of mems) {
    const key = m.plan_name ?? "Unknown";
    const ord = m.order_id ? paidById.get(m.order_id) : undefined;
    const cur = byPlan.get(key) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += ord ? Number(ord.amount ?? 0) : 0;
    byPlan.set(key, cur);
  }
  const membersByPlan = Array.from(byPlan.entries()).map(([plan_name, v]) => ({
    plan_name,
    ...v,
  }));

  const recentTransactions = paid
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
    .map((o) => {
      const mem = mems.find((m) => m.order_id === o.id);
      return {
        buyer_email: o.buyer_email,
        plan: mem?.plan_name ?? null,
        amount: Number(o.amount ?? 0),
        created_at: o.created_at,
      };
    });

  const plans = ((plansRaw ?? []) as Array<{
    id: string;
    name: string;
    price: number;
    duration_label: string;
    subscriber_count: number;
  }>).map((p) => {
    const pb = byPlan.get(p.name);
    return {
      id: p.id,
      name: p.name,
      price: Number(p.price ?? 0),
      duration_label: p.duration_label,
      subscriber_count: pb?.count ?? p.subscriber_count ?? 0,
      revenue: pb?.revenue ?? 0,
    };
  });

  return {
    ok: true,
    data: {
      group: {
        id: group.id,
        group_name: group.group_name,
        channel_type: group.channel_type,
        channel_username: group.channel_username,
        logo_url: group.logo_url,
        setup_complete: group.setup_complete,
        slug: pageRow?.slug ?? null,
        pageUrl: pageRow?.slug ? `${APP_URL}/p/${pageRow.slug}` : null,
      },
      plans,
      stats: {
        totalPageViews: Number(group.total_page_views ?? 0) || (viewCount ?? 0),
        totalSales,
        totalSubscriptions: mems.length,
        activeMembers,
        churnRate,
        recentTransactions,
        topMembers,
        salesByDay,
        membersByPlan,
      },
    },
  };
}
