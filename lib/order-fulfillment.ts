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
import { resolvePlatformFeePaise, feeCategoryForPage } from "@/lib/fees";
import type { PlanKey } from "@/lib/plans";

type DB = SupabaseClient;

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
    const resolved = resolvePlatformFeePaise(
      {
        plan,
        feeCategory: args.feeCategory ?? null,
        orderAmountPaise: args.orderAmountPaise,
      },
      await getFeeConfig(),
    );
    const feePaise = resolved ?? getWalletFeePaise(plan);
    if (feePaise <= 0) return true;
    const { data: w } = await admin
      .from("seller_wallets")
      .select("balance_paise")
      .eq("seller_user_id", args.sellerUserId)
      .maybeSingle();
    return Number(w?.balance_paise ?? 0) >= feePaise;
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

    const { data: deducted, error: deductErr } = await admin.rpc(
      "deduct_wallet_balance",
      {
        p_seller_id: sellerUserId,
        p_amount_paise: feePaise,
        p_order_id: orderId,
        p_description: `Platform fee — Order #${orderId.slice(-8).toUpperCase()}`,
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
