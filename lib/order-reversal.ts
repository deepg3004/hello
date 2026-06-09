// =============================================================================
// Reversals applied when a paid order is refunded. All are best-effort and never
// throw into the caller — the buyer's money is already being returned, so a
// failure here must not abort the refund. Idempotency is the CALLER's job: the
// refund action only runs these after winning the guarded order status
// transition (paid → refunded), so each runs at most once per order.
// =============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient;

/**
 * Credit the platform wallet fee charged for this order back to the seller's
 * wallet. The fee was debited via deduct_wallet_balance (a wallet_transactions
 * row of type='debit' tied to order_id); we sum those and credit the total back.
 *
 * Policy: the per-order platform fee is a fixed fee, not proportional to the
 * order amount, so we reverse it in full only when the order is FULLY refunded
 * (the caller decides when to invoke this).
 */
export async function reversePlatformWalletFee(
  orderId: string,
  sellerUserId: string,
  admin: DB,
): Promise<void> {
  try {
    const { data: feeRows } = await admin
      .from("wallet_transactions")
      .select("amount_paise")
      .eq("order_id", orderId)
      .eq("type", "debit");
    const feePaise = (feeRows ?? []).reduce(
      (s, r) => s + Number((r as { amount_paise: number }).amount_paise || 0),
      0,
    );
    if (feePaise <= 0) return;
    await admin.rpc("credit_wallet_balance", {
      p_seller_id: sellerUserId,
      p_amount_paise: feePaise,
      p_description: `Platform fee refund — Order #${orderId.slice(-8).toUpperCase()}`,
    });
  } catch (e) {
    console.error("[order-reversal] wallet fee reversal failed", e);
  }
}

/** Add `qty` back to a product's (or variant's) tracked stock. No-op when stock
 *  is untracked (null) — i.e. digital products. */
async function restock(
  admin: DB,
  productId: string | null,
  variantId: string | null,
  qty: number,
): Promise<void> {
  if (qty <= 0) return;
  try {
    if (variantId) {
      const { data: v } = await admin
        .from("product_variants")
        .select("stock")
        .eq("id", variantId)
        .maybeSingle();
      const cur = (v as { stock: number | null } | null)?.stock;
      if (cur != null) {
        await admin
          .from("product_variants")
          .update({ stock: Number(cur) + qty })
          .eq("id", variantId);
      }
      return; // variant-tracked line — product stock wasn't decremented
    }
    if (productId) {
      const { data: p } = await admin
        .from("products")
        .select("stock")
        .eq("id", productId)
        .maybeSingle();
      const cur = (p as { stock: number | null } | null)?.stock;
      if (cur != null) {
        await admin
          .from("products")
          .update({ stock: Number(cur) + qty })
          .eq("id", productId);
      }
    }
  } catch (e) {
    console.error("[order-reversal] restock failed", productId ?? variantId, e);
  }
}

/**
 * Reverse the fulfilment side-effects of a refunded order:
 *   • restore inventory (mirrors the decrement in cart/single-item fulfilment)
 *   • revoke digital access the buyer was granted:
 *       - course enrollment (delete; the JIT heal only re-enrolls `paid`
 *         orders, so a refunded order won't be re-granted)
 *       - download grants (delete → /api/download 404s)
 *       - Telegram / Discord memberships (mark 'removed')
 *
 * Everything is best-effort; a partial failure leaves the rest applied.
 */
export async function reverseFulfillmentForOrder(
  orderId: string,
  admin: DB,
): Promise<void> {
  // ── Inventory restore ──────────────────────────────────────────────────────
  try {
    const { data: items } = await admin
      .from("order_items")
      .select("product_id, variant_id, quantity")
      .eq("order_id", orderId);
    const lines = (items ?? []) as Array<{
      product_id: string | null;
      variant_id: string | null;
      quantity: number;
    }>;
    if (lines.length > 0) {
      for (const l of lines) {
        await restock(admin, l.product_id, l.variant_id, Number(l.quantity) || 1);
      }
    } else {
      const { data: order } = await admin
        .from("orders")
        .select("product_id")
        .eq("id", orderId)
        .maybeSingle();
      const pid = (order as { product_id: string | null } | null)?.product_id ?? null;
      if (pid) await restock(admin, pid, null, 1);
    }
  } catch (e) {
    console.error("[order-reversal] inventory restore failed", e);
  }

  // ── Revoke access ──────────────────────────────────────────────────────────
  try {
    await admin.from("course_enrollments").delete().eq("order_id", orderId);
  } catch (e) {
    console.error("[order-reversal] revoke course enrollment failed", e);
  }
  try {
    await admin.from("download_grants").delete().eq("order_id", orderId);
  } catch (e) {
    console.error("[order-reversal] revoke download grants failed", e);
  }
  try {
    await admin
      .from("telegram_memberships")
      .update({ status: "removed" })
      .eq("order_id", orderId)
      .neq("status", "removed");
  } catch (e) {
    console.error("[order-reversal] revoke telegram membership failed", e);
  }
  try {
    await admin
      .from("discord_memberships")
      .update({ status: "removed" })
      .eq("order_id", orderId)
      .neq("status", "removed");
  } catch (e) {
    console.error("[order-reversal] revoke discord membership failed", e);
  }
}
