"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
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

/**
 * Convert a raw MTProto chat id to the Bot-API "marked" chat id the bot needs
 * for getChat / createChatInviteLink / kick: channels & supergroups are
 * -100<id>, basic groups are -<id>.
 */
function botApiChatId(
  mtprotoId: string,
  type: "channel" | "supergroup" | "group",
): string {
  const id = mtprotoId.replace(/^-?(100)?/, "");
  return type === "group" ? `-${id}` : `-100${id}`;
}

// Returns { id: effective-owner-id } when the actor may manage Telegram, else
// null. All channel setup/membership actions act on the owner's account.
async function authUser() {
  const actor = await requireActor("telegram.manage");
  return actor.ok ? { id: actor.ctx.ownerId } : null;
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
    // Bot-API marked chat id (-100… for channels) — used to mint invite links.
    group_chat_id: botApiChatId(data.chatId, data.channelType),
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
  /** ISO datetime — drives the public-page countdown / limited-time offer. */
  offerEndsAt?: string | null;
  theme?: string;
  bgAnimation?: string;
  logoUrl?: string | null;
  checkoutQuestions?: Array<{ label: string; required: boolean }>;
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
  const logoUrl = data.logoUrl ?? group.logo_url ?? null;

  // 1. Resolve the page row (reuse auto_page_id on re-publish, else create).
  let pageId = group.auto_page_id as string | null;
  let slug: string;

  const pageConfig = {
    group_id: group.id,
    group_name: pageName,
    group_avatar: logoUrl ?? undefined,
    channel_type: group.channel_type,
    channel_username: group.channel_username,
    active_members: group.total_member_count ?? 0,
    description: group.page_description ?? "",
    category: group.category ?? "General",
    auto_renewal: data.autoRenewal,
    offer_ends_at: data.offerEndsAt ?? null,
    theme: data.theme ?? "purple",
    bg_animation: data.bgAnimation ?? "none",
    checkout_questions: (data.checkoutQuestions ?? [])
      .filter((q) => q.label.trim())
      .slice(0, 5)
      .map((q) => ({ label: q.label.trim().slice(0, 120), required: !!q.required })),
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
        original_price: p.originalPrice ?? null,
        is_popular: p.isPopular,
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
      logo_url: logoUrl,
      auto_renewal_enabled: data.autoRenewal,
      setup_complete: true,
    })
    .eq("id", group.id);

  // Link the page BACK to the group — issueInviteForOrder reads
  // pages.telegram_group_id to mint the invite. Without this, invites are
  // silently skipped and no membership row is created.
  await admin
    .from("pages")
    .update({ telegram_group_id: group.id })
    .eq("id", pageId);

  revalidatePath("/dashboard/telegram");
  return { ok: true, data: { slug, pageUrl: `${APP_URL}/p/${slug}` } };
}

// ── Plan editor (existing channels) ─────────────────────────────────────────

export interface EditablePlan {
  name: string;
  description: string | null;
  price: number;
  originalPrice: number | null;
  durationDays: number;
  durationLabel: string;
  isPopular: boolean;
}

/** Load a channel's current plans + publish state for the editor. */
export async function getChannelPlansAction(groupId: string): Promise<
  ActionResult<{
    groupName: string;
    autoRenewal: boolean;
    published: boolean;
    pageUrl: string | null;
    offerEndsAt: string | null;
    theme: string;
    bgAnimation: string;
    logoUrl: string | null;
    checkoutQuestions: Array<{ label: string; required: boolean }>;
    plans: EditablePlan[];
  }>
> {
  const user = await authUser();
  if (!user) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();

  const { data: group } = await admin
    .from("telegram_vip_groups")
    .select("id, user_id, group_name, page_name, logo_url, auto_renewal_enabled, auto_page_id")
    .eq("id", groupId)
    .maybeSingle();
  if (!group || group.user_id !== user.id) return { ok: false, message: "Channel not found" };

  const [{ data: plansRaw }, { data: pageRow }] = await Promise.all([
    admin
      .from("telegram_subscription_plans")
      .select("name, description, price, original_price, duration_days, duration_label, is_popular")
      .eq("group_id", groupId)
      .order("sort_order", { ascending: true }),
    group.auto_page_id
      ? admin.from("pages").select("slug, status, page_config").eq("id", group.auto_page_id).maybeSingle()
      : Promise.resolve({ data: null as { slug: string; status: string; page_config: Record<string, unknown> | null } | null }),
  ]);

  const cfg = (pageRow?.page_config as Record<string, unknown> | null) ?? null;
  const offerEndsAt = (cfg?.offer_ends_at as string | null) ?? null;
  const theme = (cfg?.theme as string) ?? "purple";
  const bgAnimation = (cfg?.bg_animation as string) ?? "none";
  const checkoutQuestions = (Array.isArray(cfg?.checkout_questions)
    ? cfg.checkout_questions
    : []) as Array<{ label: string; required: boolean }>;

  const plans: EditablePlan[] = ((plansRaw ?? []) as Array<{
    name: string;
    description: string | null;
    price: number;
    original_price: number | null;
    duration_days: number;
    duration_label: string;
    is_popular: boolean;
  }>).map((p) => ({
    name: p.name,
    description: p.description,
    price: Number(p.price),
    originalPrice: p.original_price != null ? Number(p.original_price) : null,
    durationDays: p.duration_days,
    durationLabel: p.duration_label,
    isPopular: p.is_popular,
  }));

  return {
    ok: true,
    data: {
      groupName: group.page_name ?? group.group_name ?? "Channel",
      autoRenewal: !!group.auto_renewal_enabled,
      published: pageRow?.status === "published",
      pageUrl: pageRow?.slug ? `${APP_URL}/p/${pageRow.slug}` : null,
      offerEndsAt,
      theme,
      bgAnimation,
      logoUrl: group.logo_url ?? null,
      checkoutQuestions,
      plans,
    },
  };
}

/** Publish / unpublish a channel's public page (pauses new subscriptions). */
export async function setChannelPublishedAction(
  groupId: string,
  published: boolean,
): Promise<ActionResult> {
  const user = await authUser();
  if (!user) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();

  const { data: group } = await admin
    .from("telegram_vip_groups")
    .select("id, user_id, auto_page_id")
    .eq("id", groupId)
    .maybeSingle();
  if (!group || group.user_id !== user.id) return { ok: false, message: "Channel not found" };
  if (!group.auto_page_id) return { ok: false, message: "No public page to update." };

  const { error } = await admin
    .from("pages")
    .update({
      status: published ? "published" : "paused",
      published_at: published ? new Date().toISOString() : null,
    })
    .eq("id", group.auto_page_id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/telegram");
  return { ok: true };
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
      ? admin.from("pages").select("slug, view_count").eq("id", pageId).maybeSingle()
      : Promise.resolve(
          { data: null } as { data: { slug: string; view_count: number } | null },
        ),
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

  // Sales from PAID orders on the page directly — robust, independent of
  // whether the membership/invite flow has completed.
  let paid: Array<{
    id: string;
    amount: number;
    buyer_email: string;
    buyer_name: string | null;
    created_at: string;
    product_id: string | null;
  }> = [];
  if (pageId) {
    const { data: ordersRaw } = await admin
      .from("orders")
      .select("id, amount, buyer_email, buyer_name, created_at, product_id")
      .eq("page_id", pageId)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(500);
    paid = (ordersRaw ?? []) as typeof paid;
  }

  // product_id -> plan name, for per-plan revenue + transaction labels.
  const planNameByProduct = new Map<string, string>(
    ((plansRaw ?? []) as Array<{ name: string; product_id: string | null }>)
      .filter((p) => p.product_id)
      .map((p) => [p.product_id as string, p.name]),
  );
  const planOf = (pid: string | null): string =>
    (pid && planNameByProduct.get(pid)) || "Plan";

  const totalSales = paid.reduce((a, o) => a + Number(o.amount ?? 0), 0);
  // "Active members" = current paying subscribers: anyone with valid access
  // (joined OR invited-but-not-yet-joined) whose plan hasn't expired. Counting
  // only status==="active" under-reported when join-binding lagged the payment.
  const nowMs = Date.now();
  const activeMembers = mems.filter(
    (m) =>
      (m.status === "active" || m.status === "invited") &&
      (!m.expires_at || new Date(m.expires_at).getTime() > nowMs),
  ).length;

  // Churn over the last 30 days.
  const cutoff = Date.now() - 30 * 86_400_000;
  const removed30 = mems.filter(
    (m) => m.removed_at && new Date(m.removed_at).getTime() >= cutoff,
  ).length;
  const churnDenom = activeMembers + removed30;
  const churnRate = churnDenom > 0 ? Math.round((removed30 / churnDenom) * 100) : 0;

  // Sales by day.
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

  // Top buyers by amount paid.
  const byEmail = new Map<string, { amount: number; joined_at: string | null }>();
  for (const o of paid) {
    const cur = byEmail.get(o.buyer_email) ?? { amount: 0, joined_at: o.created_at };
    cur.amount += Number(o.amount ?? 0);
    byEmail.set(o.buyer_email, cur);
  }
  const topMembers = Array.from(byEmail.entries())
    .map(([buyer_email, v]) => ({ buyer_email, amount: v.amount, joined_at: v.joined_at }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Revenue + count by plan.
  const byPlan = new Map<string, { count: number; revenue: number }>();
  for (const o of paid) {
    const key = planOf(o.product_id);
    const cur = byPlan.get(key) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += Number(o.amount ?? 0);
    byPlan.set(key, cur);
  }
  const membersByPlan = Array.from(byPlan.entries()).map(([plan_name, v]) => ({
    plan_name,
    ...v,
  }));

  const recentTransactions = paid.slice(0, 5).map((o) => ({
    buyer_email: o.buyer_email,
    plan: planOf(o.product_id),
    amount: Number(o.amount ?? 0),
    created_at: o.created_at,
  }));

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
        totalPageViews:
          Number(pageRow?.view_count ?? 0) ||
          Number(group.total_page_views ?? 0) ||
          (viewCount ?? 0),
        totalSales,
        totalSubscriptions: paid.length,
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
