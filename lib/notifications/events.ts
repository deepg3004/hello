import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { formatINR } from "@/lib/utils";

import { createNotification, notifyAdmins } from "./create";

/**
 * High-level, typed notification builders — one per real-world event.
 *
 * Each builder writes the seller-facing copy AND (per product decision) fans
 * the same event out to every admin with platform-context copy, so the admin
 * bell mirrors all activity. Builders own their own display-field lookups so
 * call sites stay a single line, and everything is best-effort: a failed
 * lookup degrades the copy, it never throws into the core flow.
 *
 * The `type` strings here are the contract with NotificationBell's icon map.
 */

type DB = SupabaseClient;

/** Notification type keys — keep in sync with NotificationBell's ICONS map. */
export type NotificationType =
  | "payment_received"
  | "page_created"
  | "kyc_approved"
  | "kyc_rejected"
  | "kyc_flagged"
  | "kyc_rekyc"
  | "telegram_join"
  | "wallet_low_balance";

// orders.amount / seller_amount are stored in rupees across this codebase
// (see the dashboard + payouts pages); formatINR expects paise.
const inr = (rupees: number) => formatINR(Math.round((rupees || 0) * 100));

async function sellerName(db: DB, userId: string): Promise<string> {
  try {
    const { data } = await db
      .from("user_profiles")
      .select("full_name")
      .eq("id", userId)
      .single();
    return (data?.full_name as string | null)?.trim() || "A seller";
  } catch {
    return "A seller";
  }
}

// ── 1. Payment received ─────────────────────────────────────────────────────
export async function notifyPaymentReceived(
  o: {
    sellerId: string;
    amountRupees: number;
    buyer?: string | null;
    pageId?: string | null;
    orderId: string;
  },
  client?: DB,
): Promise<void> {
  const db = client ?? createAdminClient();
  let pageTitle: string | null = null;
  if (o.pageId) {
    try {
      const { data } = await db
        .from("pages")
        .select("title")
        .eq("id", o.pageId)
        .single();
      pageTitle = (data?.title as string | null) ?? null;
    } catch {
      /* best-effort */
    }
  }
  const amt = inr(o.amountRupees);
  const forPage = pageTitle ? ` for “${pageTitle}”` : "";

  await createNotification(
    {
      userId: o.sellerId,
      type: "payment_received",
      title: "Payment received 🎉",
      body: `${amt}${forPage}${o.buyer ? ` from ${o.buyer}` : ""}`,
      link: "/dashboard/transactions",
      meta: { orderId: o.orderId },
    },
    db,
  );
  await notifyAdmins(
    {
      type: "payment_received",
      title: "New payment",
      body: `${amt}${forPage}`,
      link: "/admin/transactions",
      meta: { orderId: o.orderId, sellerId: o.sellerId },
    },
    db,
  );
}

// ── 2. New page created ─────────────────────────────────────────────────────
export async function notifyPageCreated(
  o: {
    sellerId: string;
    pageId: string;
    title: string;
    type: string;
    published: boolean;
  },
  client?: DB,
): Promise<void> {
  const db = client ?? createAdminClient();
  const verb = o.published ? "published" : "created";

  await createNotification(
    {
      userId: o.sellerId,
      type: "page_created",
      title: `Page ${verb}`,
      body: `“${o.title}” is ${o.published ? "live" : "saved as a draft"}.`,
      link: `/dashboard/pages/${o.pageId}/edit`,
      meta: { pageId: o.pageId, type: o.type },
    },
    db,
  );
  const who = await sellerName(db, o.sellerId);
  await notifyAdmins(
    {
      type: "page_created",
      title: "New page created",
      body: `${who} ${verb} “${o.title}”.`,
      link: "/admin/pages",
      meta: { pageId: o.pageId, sellerId: o.sellerId },
    },
    db,
  );
}

// ── 3–6. KYC lifecycle (approved / rejected / flagged / re-KYC) ─────────────
type KycKind = "approved" | "rejected" | "flagged" | "rekyc";

export async function notifyKyc(
  o: { userId: string; kind: KycKind; reason?: string; flags?: string[] },
  client?: DB,
): Promise<void> {
  const db = client ?? createAdminClient();

  // Seller-facing copy.
  const seller: Record<KycKind, { title: string; body: string }> = {
    approved: {
      title: "KYC approved ✅",
      body: "Your identity is verified — payouts are now enabled.",
    },
    rejected: {
      title: "KYC rejected",
      body: o.reason
        ? `Reason: ${o.reason}`
        : "Your KYC submission was rejected. Please review and resubmit.",
    },
    flagged: {
      title: "KYC under review",
      body: "Your KYC needs a manual review. We'll update you shortly.",
    },
    rekyc: {
      title: "Re-verification required",
      body: o.reason
        ? `Please complete KYC again. Reason: ${o.reason}`
        : "Please complete your KYC again to keep payouts enabled.",
    },
  };

  await createNotification(
    {
      userId: o.userId,
      type:
        o.kind === "approved"
          ? "kyc_approved"
          : o.kind === "rejected"
            ? "kyc_rejected"
            : o.kind === "flagged"
              ? "kyc_flagged"
              : "kyc_rekyc",
      title: seller[o.kind].title,
      body: seller[o.kind].body,
      link: "/dashboard/kyc",
      meta: { flags: o.flags ?? [] },
    },
    db,
  );

  // Admin-facing copy.
  const who = await sellerName(db, o.userId);
  const admin: Record<KycKind, { title: string; body: string }> = {
    approved: { title: "KYC approved", body: `${who}'s KYC was approved.` },
    rejected: { title: "KYC rejected", body: `${who}'s KYC was rejected.` },
    flagged: {
      title: "KYC flagged for review",
      body: `${who}'s KYC was auto-flagged${
        o.flags?.length ? `: ${o.flags.join(", ")}` : ""
      }.`,
    },
    rekyc: {
      title: "Re-KYC requested",
      body: `Re-verification was requested for ${who}.`,
    },
  };
  await notifyAdmins(
    {
      type:
        o.kind === "approved"
          ? "kyc_approved"
          : o.kind === "rejected"
            ? "kyc_rejected"
            : o.kind === "flagged"
              ? "kyc_flagged"
              : "kyc_rekyc",
      title: admin[o.kind].title,
      body: admin[o.kind].body,
      link: "/admin/kyc",
      meta: { userId: o.userId, flags: o.flags ?? [] },
    },
    db,
  );

  // Email the seller too — the bell is in-app only. Best-effort: a mail
  // failure must never break the KYC flow.
  try {
    const { data: prof } = await db
      .from("user_profiles")
      .select("full_name, email, kyc_level")
      .eq("id", o.userId)
      .single();
    const to = (prof?.email as string | null) ?? null;
    const name = (prof?.full_name as string | null) ?? null;
    if (to) {
      const { enqueueEmail } = await import("@/lib/queues/email");
      if (o.kind === "approved") {
        const level = (Number(prof?.kyc_level) || 2) as 1 | 2 | 3;
        await enqueueEmail({
          template: "kyc_approved",
          to,
          data: { seller_name: name, level },
        });
      } else if (o.kind === "rejected" || o.kind === "rekyc") {
        await enqueueEmail({
          template: "kyc_rejected",
          to,
          data: {
            seller_name: name,
            reason:
              o.reason ??
              (o.kind === "rekyc"
                ? "Re-verification is required to keep payouts enabled."
                : null),
          },
        });
      } else if (o.kind === "flagged") {
        // Submitted but needs manual review — confirm receipt to the seller.
        await enqueueEmail({
          template: "kyc_received",
          to,
          data: { seller_name: name, manual: true },
        });
      }
    }
  } catch {
    /* best-effort */
  }
}

// ── 8. Low wallet balance ───────────────────────────────────────────────────
// Fired (best-effort) from the checkout flow when a platform-fee deduction
// can't be taken because the seller's wallet is empty/insufficient. Seller-only
// — admins don't need a bell for every seller's low balance.
export async function notifyLowWalletBalance(
  o: { sellerId: string },
  client?: DB,
): Promise<void> {
  const db = client ?? createAdminClient();
  let balancePaise = 0;
  try {
    const { data } = await db
      .from("seller_wallets")
      .select("balance_paise")
      .eq("seller_user_id", o.sellerId)
      .single();
    balancePaise = Number(data?.balance_paise ?? 0);
  } catch {
    /* best-effort — table may not exist until migration 040 is applied */
  }

  await createNotification(
    {
      userId: o.sellerId,
      type: "wallet_low_balance",
      title: "Low wallet balance",
      // formatINR expects paise (see the `inr` helper above).
      body: `Your InvoxAI wallet balance is ${formatINR(balancePaise)}. Recharge to keep your store active.`,
      link: "/dashboard/wallet",
      meta: { balance_paise: balancePaise },
    },
    db,
  );
}

// ── 7. New Telegram join ────────────────────────────────────────────────────
export async function notifyTelegramJoin(
  o: { groupId: string; sellerId?: string | null; buyerLabel?: string | null },
  client?: DB,
): Promise<void> {
  const db = client ?? createAdminClient();

  let sellerId = o.sellerId ?? null;
  let channel = "your VIP channel";
  try {
    const { data } = await db
      .from("telegram_vip_groups")
      .select("user_id, group_name")
      .eq("id", o.groupId)
      .single();
    sellerId = sellerId ?? ((data?.user_id as string | null) ?? null);
    if (data?.group_name) channel = `“${data.group_name as string}”`;
  } catch {
    /* best-effort */
  }
  if (!sellerId) return;

  const who = o.buyerLabel?.trim() || "A new member";

  await createNotification(
    {
      userId: sellerId,
      type: "telegram_join",
      title: "New Telegram member",
      body: `${who} joined ${channel}.`,
      link: "/dashboard/telegram",
      meta: { groupId: o.groupId },
    },
    db,
  );
  await notifyAdmins(
    {
      type: "telegram_join",
      title: "Telegram join",
      body: `${who} joined ${channel}.`,
      link: "/admin/telegram",
      meta: { groupId: o.groupId, sellerId },
    },
    db,
  );
}
