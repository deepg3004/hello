import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Low-level writers for the in-app notification feed (the bell).
 *
 * Every function here is BEST-EFFORT: notifications must never break the core
 * flow that triggers them (a payment, a KYC review, a Telegram join). All DB
 * access is wrapped in try/catch and logs rather than throws. Inserts use the
 * service-role admin client so they work from API routes, server actions, and
 * workers alike (RLS only gates reads/mark-read by the recipient).
 */

type DB = SupabaseClient;

export interface NewNotification {
  /** Recipient. Seller events → the seller; admin events → each admin row. */
  userId: string;
  /** Stable event key — drives the icon/colour in the bell (see events.ts). */
  type: string;
  title: string;
  body?: string | null;
  /** Where clicking the row navigates (relative path). */
  link?: string | null;
  meta?: Record<string, unknown>;
}

function toRows(list: NewNotification[]) {
  return list.map((n) => ({
    user_id: n.userId,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
    meta: n.meta ?? {},
  }));
}

export async function createNotifications(
  list: NewNotification[],
  client?: DB,
): Promise<void> {
  const valid = list.filter((n) => n.userId);
  if (valid.length === 0) return;
  const db = client ?? createAdminClient();
  try {
    const { error } = await db.from("notifications").insert(toRows(valid));
    if (error) console.error("[notifications] insert failed:", error.message);
  } catch (e) {
    console.error("[notifications] insert threw:", e);
  }
}

export async function createNotification(
  n: NewNotification,
  client?: DB,
): Promise<void> {
  return createNotifications([n], client);
}

/**
 * Fan a platform-wide notification out to every admin — one row per admin so
 * read-state is independent across admins. No-op if there are no admins.
 */
export async function notifyAdmins(
  n: Omit<NewNotification, "userId">,
  client?: DB,
): Promise<void> {
  const db = client ?? createAdminClient();
  try {
    const { data, error } = await db
      .from("user_profiles")
      .select("id")
      .eq("is_admin", true);
    if (error) {
      console.error("[notifications] admin lookup failed:", error.message);
      return;
    }
    const rows = (data ?? []).map((a) => ({ ...n, userId: a.id as string }));
    await createNotifications(rows, db);
  } catch (e) {
    console.error("[notifications] notifyAdmins threw:", e);
  }
}
