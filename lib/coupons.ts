// =============================================================================
// Server-side coupon validation + atomic reservation.
//
// Two-step lifecycle:
//
//   1. validateCoupon(...)   — read-only, used by GET /api/coupons/validate
//   2. reserveCoupon(...)    — atomic INCR in Redis when creating the order
//   3. releaseCoupon(...)    — DECR if the order ultimately fails
//   4. settleCoupon(...)     — mark usage in Postgres when payment captures
//
// Redis keeps the high-traffic counter; Postgres holds the authoritative
// long-term tally that we reconcile on payment success.
// =============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { getRedis } from "@/lib/redis";
import { computeDiscount } from "@/lib/pricing";

export { computeDiscount };

export interface CouponValidationOk {
  valid: true;
  coupon_id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  /** Rupees taken off the gross. Capped at max_discount when present. */
  discount_amount: number;
}

export interface CouponValidationFail {
  valid: false;
  reason: string;
}

export type CouponValidationResult = CouponValidationOk | CouponValidationFail;

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Validate a coupon for a (page, amount) pair WITHOUT consuming a slot.
 * Safe to call from the public GET endpoint.
 */
export async function validateCoupon(args: {
  code: string;
  page_id: string;
  amount: number;
  buyer_email?: string;
}): Promise<CouponValidationResult> {
  const admin = createAdminClient();

  // Resolve seller via page.
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id, status")
    .eq("id", args.page_id)
    .single();

  if (!page) return { valid: false, reason: "Page not found" };
  if (page.status !== "published") return { valid: false, reason: "Page not live" };

  // Look up coupon scoped to this seller.
  const { data: coupon } = await admin
    .from("coupons")
    .select(
      "id, code, discount_type, discount_value, min_order, max_discount, total_limit, per_customer_limit, usage_count, starts_at, expires_at, page_ids, active",
    )
    .eq("user_id", page.user_id)
    .eq("code", args.code)
    .single();

  if (!coupon) return { valid: false, reason: "Coupon not found" };
  if (!coupon.active) return { valid: false, reason: "Coupon is not active" };
  if (coupon.starts_at && coupon.starts_at > nowIso()) {
    return { valid: false, reason: "Coupon hasn't started yet" };
  }
  if (coupon.expires_at && coupon.expires_at < nowIso()) {
    return { valid: false, reason: "Coupon has expired" };
  }
  if (coupon.min_order && args.amount < Number(coupon.min_order)) {
    return {
      valid: false,
      reason: `Minimum order ₹${coupon.min_order} required`,
    };
  }
  if (
    Array.isArray(coupon.page_ids) &&
    coupon.page_ids.length > 0 &&
    !coupon.page_ids.includes(args.page_id)
  ) {
    return { valid: false, reason: "Coupon does not apply to this page" };
  }

  // Global limit check — Redis if available, else DB tally.
  if (coupon.total_limit != null) {
    const redis = getRedis();
    const usedKey = `coupon:${coupon.id}:used`;
    let used = Number(coupon.usage_count ?? 0);
    if (redis) {
      const v = await redis.get(usedKey);
      if (v != null) used = Math.max(used, Number(v));
    }
    if (used >= coupon.total_limit) {
      return { valid: false, reason: "Coupon limit reached" };
    }
  }

  // Per-customer limit check (best effort — requires buyer_email).
  if (args.buyer_email && coupon.per_customer_limit) {
    const redis = getRedis();
    if (redis) {
      const k = `coupon:${coupon.id}:cust:${args.buyer_email.toLowerCase()}`;
      const v = Number((await redis.get(k)) ?? "0");
      if (v >= coupon.per_customer_limit) {
        return { valid: false, reason: "You've already used this coupon" };
      }
    }
  }

  const discount_amount = computeDiscount(
    coupon.discount_type as "percentage" | "fixed",
    Number(coupon.discount_value),
    args.amount,
    coupon.max_discount != null ? Number(coupon.max_discount) : null,
  );

  return {
    valid: true,
    coupon_id: coupon.id,
    code: coupon.code,
    discount_type: coupon.discount_type as "percentage" | "fixed",
    discount_value: Number(coupon.discount_value),
    discount_amount,
  };
}

/**
 * Atomically reserve a coupon slot during order creation. Returns false if
 * the limit was hit by a concurrent buyer.
 */
export async function reserveCoupon(
  coupon_id: string,
  total_limit: number | null,
  buyer_email: string | null,
  per_customer_limit: number | null,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true; // best-effort without redis; reconcile on payment

  if (total_limit != null) {
    const k = `coupon:${coupon_id}:used`;
    const next = await redis.incr(k);
    if (next > total_limit) {
      await redis.decr(k);
      return false;
    }
  }
  if (buyer_email && per_customer_limit) {
    const k = `coupon:${coupon_id}:cust:${buyer_email.toLowerCase()}`;
    const next = await redis.incr(k);
    if (next > per_customer_limit) {
      await redis.decr(k);
      // If we already incremented the global counter, roll that back too.
      if (total_limit != null) await redis.decr(`coupon:${coupon_id}:used`);
      return false;
    }
  }
  return true;
}

/** Release a previously reserved slot when an order fails before capture. */
export async function releaseCoupon(
  coupon_id: string,
  buyer_email: string | null,
) {
  const redis = getRedis();
  if (!redis) return;
  await redis.decr(`coupon:${coupon_id}:used`);
  if (buyer_email) {
    await redis.decr(`coupon:${coupon_id}:cust:${buyer_email.toLowerCase()}`);
  }
}

/**
 * Atomically increment usage_count for a coupon. Returns true if the
 * increment happened, false if the coupon was already at its limit.
 *
 * Uses the `increment_coupon_usage` RPC (migration 035) which gates AND
 * increments in a single row-locked UPDATE — the only way to make the cap
 * hold under concurrency. (The previous read-then-write path had a lost-update
 * race that could redeem a total_limit=1 coupon twice.)
 *
 * Falls back to the older guarded update if the RPC isn't deployed yet, so
 * this is safe to ship before the migration is applied.
 */
export async function settleCoupon(coupon_id: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("increment_coupon_usage", {
    p_coupon_id: coupon_id,
  });

  if (!error) return data === true;

  // ── Fallback (RPC not yet deployed) ──────────────────────────────────────
  // Not race-proof, but preserves behaviour until migration 035 is applied.
  const { data: row } = await admin
    .from("coupons")
    .select("total_limit, usage_count")
    .eq("id", coupon_id)
    .single();
  if (!row) return false;

  const current = Number(row.usage_count ?? 0);
  const limit = row.total_limit == null ? null : Number(row.total_limit);

  if (limit === null) {
    await admin
      .from("coupons")
      .update({ usage_count: current + 1 })
      .eq("id", coupon_id);
    return true;
  }

  const { data: updated } = await admin
    .from("coupons")
    .update({ usage_count: current + 1 })
    .eq("id", coupon_id)
    .lt("usage_count", limit)
    .select("id");
  return (updated?.length ?? 0) > 0;
}
