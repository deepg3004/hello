// =============================================================================
// Shared order-fulfillment helpers used by BOTH the in-checkout handler
// (app/api/checkout/verify-payment) and the seller-gateway webhook
// (app/api/webhooks/razorpay/seller) so the platform-revenue logic can't drift
// between the two paths. Server-only.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

import { getWalletFeePaise } from "@/lib/wallet";
import { notifyLowWalletBalance } from "@/lib/notifications/events";
import { getFeeConfig, getRequireWalletBalance } from "@/lib/settings";
import {
  resolvePlatformFeePaise,
  feeCategoryForPage,
  gstPercentFromConfig,
  gstOnFeePaise,
} from "@/lib/fees";
import { formatINR } from "@/lib/utils";
import type { PlanKey } from "@/lib/plans";

type DB = SupabaseClient;

/** Order fields needed to deliver the purchased products to the buyer. */
export interface DeliverableOrder {
  id: string;
  page_id: string | null;
  product_id: string | null;
  seller_user_id: string;
  buyer_email: string;
  buyer_name: string | null;
  amount: number;
  currency?: string | null;
}

/**
 * Deliver everything the buyer paid for, for a SINGLE-ITEM (non-cart) order:
 * receipt email, GST invoice, Telegram invite, Discord access, course
 * enrollment, and any digital-download grant. Each step is independent and
 * best-effort — a failure in one never blocks the others or throws into the
 * caller. Idempotent at the data layer (enroll / grant / invite are keyed by
 * order), so it's safe to call from BOTH the in-checkout verify-payment route
 * AND the seller-gateway webhook fallback (so a dropped-tab payment still
 * delivers the product). Cart orders use fulfillCartOrder instead.
 */
export async function deliverOrderProducts(
  order: DeliverableOrder,
  admin: DB,
): Promise<void> {
  // ── Buyer receipt email ────────────────────────────────────────────────────
  try {
    const { sendEmail } = await import("@/lib/email");
    const { renderEmail } = await import("@/lib/emails/render");
    const { data: prod } = order.product_id
      ? await admin
          .from("products")
          .select("name")
          .eq("id", order.product_id)
          .single<{ name: string }>()
      : { data: null };
    const { data: sellerForReceipt } = await admin
      .from("user_profiles")
      .select("legal_business_name, full_name")
      .eq("id", order.seller_user_id)
      .single<{ legal_business_name: string | null; full_name: string | null }>();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
    const tpl = await renderEmail("sale_receipt", {
      buyerName: order.buyer_name,
      sellerLegalName:
        sellerForReceipt?.legal_business_name ??
        sellerForReceipt?.full_name ??
        null,
      productName: prod?.name ?? null,
      amountInr: Number(order.amount),
      currency: order.currency ?? "INR",
      orderId: order.id,
      invoiceUrl: `${baseUrl}/api/orders/${order.id}/invoice`,
      orderUrl: `${baseUrl}/order/${order.id}`,
    });
    await sendEmail({
      to: order.buyer_email,
      role: "billing",
      subject: tpl.subject,
      html: tpl.html,
      sellerId: order.seller_user_id,
    });
  } catch (e) {
    console.error("[deliver] receipt email failed", e);
  }

  // ── GST invoice (background) ───────────────────────────────────────────────
  try {
    const { enqueueInvoiceJob } = await import("@/lib/queues/invoices");
    void enqueueInvoiceJob(order.id);
  } catch (e) {
    console.error("[deliver] invoice enqueue failed", e);
  }

  // ── Telegram VIP invite + email ────────────────────────────────────────────
  try {
    const { issueInviteForOrder } = await import("@/actions/telegram");
    const inviteResult = await issueInviteForOrder(order.id);
    if (inviteResult.ok && "invite_link" in inviteResult) {
      const { sendEmail } = await import("@/lib/email");
      const { renderEmail } = await import("@/lib/emails/render");
      const { data: page } = await admin
        .from("pages")
        .select("telegram_group_id, telegram_vip_groups(group_name)")
        .eq("id", order.page_id ?? "")
        .single();
      type Joined = { group_name: string | null };
      const groupRel = (
        page as unknown as { telegram_vip_groups: Joined | Joined[] | null } | null
      )?.telegram_vip_groups;
      const groupName =
        (Array.isArray(groupRel) ? groupRel[0]?.group_name : groupRel?.group_name) ??
        undefined;
      const tpl = await renderEmail("telegram_invite", {
        buyerName: order.buyer_name ?? undefined,
        groupName,
        inviteLink: inviteResult.invite_link,
      });
      await sendEmail({
        to: order.buyer_email,
        role: "buyer",
        subject: tpl.subject,
        html: tpl.html,
        sellerId: order.seller_user_id,
      });
    }
  } catch (e) {
    console.error("[deliver] telegram invite failed", e);
  }

  // ── Discord access (sends its own invite email) ────────────────────────────
  try {
    const { issueDiscordAccessForOrder } = await import("@/actions/discord");
    await issueDiscordAccessForOrder(order.id);
  } catch (e) {
    console.error("[deliver] discord invite failed", e);
  }

  // ── Course enrollment ──────────────────────────────────────────────────────
  try {
    const { createEnrollmentForOrder } = await import("@/lib/courses");
    await createEnrollmentForOrder(
      {
        id: order.id,
        product_id: order.product_id,
        buyer_email: order.buyer_email,
      },
      admin,
    );
  } catch (e) {
    console.error("[deliver] course enrollment failed", e);
  }

  // ── Digital download grant + email ─────────────────────────────────────────
  try {
    if (order.product_id) {
      const { grantDigitalDownloads } = await import("@/lib/downloads");
      await grantDigitalDownloads(
        {
          orderId: order.id,
          sellerUserId: order.seller_user_id,
          buyerEmail: order.buyer_email,
          productIds: [order.product_id],
        },
        admin,
      );
    }
  } catch (e) {
    console.error("[deliver] digital download grant failed", e);
  }

  // ── Drip automation: enroll the buyer into any active 'purchase' sequences ──
  try {
    const { enrollInSequences } = await import("@/lib/sequences");
    await enrollInSequences(
      {
        sellerUserId: order.seller_user_id,
        trigger: "purchase",
        email: order.buyer_email,
        name: order.buyer_name,
      },
      admin,
    );
  } catch (e) {
    console.error("[deliver] sequence enroll failed", e);
  }
}

/**
 * Wallet-balance gate for checkout. Returns false (→ block the order) ONLY when
 * the admin setting `require_wallet_balance` is on AND the seller's wallet can't
 * cover the per-order platform fee. Returns true when the gate is off, the fee
 * is zero, the balance is sufficient, or anything errors (fail-open so a
 * transient error never blocks every checkout).
 *
 * Without this, an empty-wallet seller still took payments (money goes straight
 * to their gateway in the no-funds model) while the platform fee silently went
 * uncollected. Mirror of the fee resolution in chargePlatformWalletFee.
 */
export async function walletCoversPlatformFee(
  args: {
    sellerUserId: string;
    orderAmountPaise: number;
    feeCategory?: string | null;
  },
  admin: DB,
): Promise<boolean> {
  try {
    if (!(await getRequireWalletBalance())) return true; // gate disabled
    const { data: sellerProfile } = await admin
      .from("user_profiles")
      .select("subscription_plan")
      .eq("id", args.sellerUserId)
      .single();
    const plan = (sellerProfile?.subscription_plan ?? "free") as PlanKey;
    const cfg = await getFeeConfig();
    const resolved = resolvePlatformFeePaise(
      {
        plan,
        feeCategory: args.feeCategory ?? null,
        orderAmountPaise: args.orderAmountPaise,
      },
      cfg,
    );
    const feePaise = resolved ?? getWalletFeePaise(plan);
    if (feePaise <= 0) return true;
    // The wallet must cover the fee PLUS the GST charged on it.
    const duePaise = feePaise + gstOnFeePaise(feePaise, gstPercentFromConfig(cfg));
    const { data: w } = await admin
      .from("seller_wallets")
      .select("balance_paise")
      .eq("seller_user_id", args.sellerUserId)
      .maybeSingle();
    return Number(w?.balance_paise ?? 0) >= duePaise;
  } catch (e) {
    console.error("[wallet-gate] check failed", e);
    return true; // fail-open — never block all checkout on an internal error
  }
}

/**
 * Decrement inventory for a paid order's product (Session 10). No-op for
 * untracked stock (null) or digital products. Best-effort — the buyer is
 * already paid, so this must never throw. Called once per order on the
 * pending→paid transition (the callers' idempotent guards ensure single-fire).
 */
export async function decrementStockForOrder(
  orderId: string,
  admin: DB,
): Promise<void> {
  try {
    const { data: order } = await admin
      .from("orders")
      .select("product_id")
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.product_id) return;
    await admin.rpc("decrement_product_stock", { p_product_id: order.product_id });
  } catch (e) {
    console.error("[order-fulfillment] decrementStockForOrder failed", e);
  }
}

/**
 * Deduct the per-order platform wallet fee for a completed order (migration
 * 040). Best-effort by design — the buyer has already been charged, so this
 * must NEVER throw into the caller. A safe no-op until migration 040 is applied
 * and the seller funds a wallet.
 *
 * On insufficient balance / no wallet row it alerts the seller to recharge, but
 * throttled to at most once per 24h and only when a wallet row exists (so a
 * seller who hasn't onboarded to the wallet model isn't notified on every
 * order). The guarded UPDATE of last_low_balance_alert_at is the gate.
 */
export async function chargePlatformWalletFee(
  args: { sellerUserId: string; orderId: string },
  admin: DB,
): Promise<void> {
  const { sellerUserId, orderId } = args;
  try {
    const { data: sellerProfile } = await admin
      .from("user_profiles")
      .select("subscription_plan")
      .eq("id", sellerUserId)
      .single();
    const plan = (sellerProfile?.subscription_plan ?? "free") as PlanKey;

    // Resolve the admin-configured fee (default / per-plan / per-category).
    // Falls back to the legacy per-plan PLANS fee when nothing is configured.
    const { data: orderRow } = await admin
      .from("orders")
      .select("amount, page_id")
      .eq("id", orderId)
      .single();
    const orderAmountPaise = Math.round(Number(orderRow?.amount ?? 0) * 100);

    let feeCategory: string | null = null;
    if (orderRow?.page_id) {
      const { data: pageRow } = await admin
        .from("pages")
        .select("type, template_id, fee_category")
        .eq("id", orderRow.page_id)
        .single();
      if (pageRow) feeCategory = feeCategoryForPage(pageRow);
    }

    const cfg = await getFeeConfig();
    const resolved = resolvePlatformFeePaise(
      { plan, feeCategory, orderAmountPaise },
      cfg,
    );
    const feePaise = resolved ?? getWalletFeePaise(plan);

    // A zero/negative fee (e.g. a percent-only rule on a ₹0 order) → nothing to
    // charge. The deduct RPC also rejects non-positive amounts.
    if (feePaise <= 0) return;

    // GST is charged on the platform fee and debited together with it as a
    // single (gross) wallet transaction — keeps the per-order idempotency guard
    // (migration 060) and the full-refund reversal (lib/order-reversal) correct,
    // since both key off the order's debit amount.
    const gstPercent = gstPercentFromConfig(cfg);
    const gstPaise = gstOnFeePaise(feePaise, gstPercent);
    const totalPaise = feePaise + gstPaise;
    const orderRef = orderId.slice(-8).toUpperCase();
    const description =
      gstPaise > 0
        ? `Platform fee ${formatINR(feePaise)} + ${gstPercent}% GST ${formatINR(gstPaise)} — Order #${orderRef}`
        : `Platform fee ${formatINR(feePaise)} — Order #${orderRef}`;

    const { data: deducted, error: deductErr } = await admin.rpc(
      "deduct_wallet_balance",
      {
        p_seller_id: sellerUserId,
        p_amount_paise: totalPaise,
        p_order_id: orderId,
        p_description: description,
      },
    );

    if (deductErr) {
      // RPC missing (pre-migration) or DB error — log and carry on.
      console.error("[wallet-fee] deduction RPC failed", deductErr);
      return;
    }
    if (deducted === false) {
      console.warn("[wallet-fee] insufficient balance for seller", sellerUserId);
      const alertCutoff = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data: alertRow } = await admin
        .from("seller_wallets")
        .update({ last_low_balance_alert_at: new Date().toISOString() })
        .eq("seller_user_id", sellerUserId)
        .or(
          `last_low_balance_alert_at.is.null,last_low_balance_alert_at.lt.${alertCutoff}`,
        )
        .select("id")
        .maybeSingle();
      if (alertRow) {
        void notifyLowWalletBalance({ sellerId: sellerUserId }, admin).catch(
          (e) => console.error("[wallet-fee] low-balance notify failed", e),
        );
      }
    }
  } catch (e) {
    console.error("[wallet-fee] deduction failed", e);
  }
}
