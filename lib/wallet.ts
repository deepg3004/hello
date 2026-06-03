// =============================================================================
// InvoxAI — Wallet fee helpers
//
// The per-order platform fee is owned by lib/plans.ts (`Plan.wallet_fee_paise`)
// so there is a single source of truth shared with the pricing page. This
// module adds the thresholds + small helpers used by the checkout deduction
// (app/api/checkout/verify-payment) and the wallet dashboard.
//
// All amounts are in PAISE (₹1 = 100 paise).
// =============================================================================

import { PLANS, type PlanKey } from "@/lib/plans";

/** Low-balance alert thresholds in paise — ₹200, ₹100, ₹50. */
export const LOW_BALANCE_ALERT_THRESHOLDS_PAISE = [20000, 10000, 5000];

/** Balance at or below which the seller's store should be paused. */
export const STORE_PAUSE_THRESHOLD_PAISE = 0;

/** Allowed wallet top-up amounts in paise — ₹500, ₹1,000, ₹2,000, ₹5,000, ₹10,000. */
export const RECHARGE_AMOUNTS_PAISE = [50000, 100000, 200000, 500000, 1000000];

/** Platform fee per completed order, in paise, for a given seller plan. */
export function getWalletFeePaise(plan: PlanKey): number {
  return PLANS[plan]?.wallet_fee_paise ?? PLANS.free.wallet_fee_paise;
}

/**
 * True when a balance change crossed a low-balance threshold this time — used
 * to alert once per crossing rather than on every order below the line.
 */
export function shouldAlertLowBalance(
  balancePaise: number,
  prevBalancePaise: number,
): boolean {
  return LOW_BALANCE_ALERT_THRESHOLDS_PAISE.some(
    (threshold) => balancePaise <= threshold && prevBalancePaise > threshold,
  );
}
