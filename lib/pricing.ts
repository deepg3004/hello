// Pure pricing math — kept dependency-free so it's unit-testable in isolation
// (lib/coupons.ts pulls in the Supabase admin client, which can't load in tests).

/**
 * Proportional ledger reversal for a (possibly partial) refund. Reverses the
 * seller's share and the platform commission in the same ratio as the refund
 * is of the gross order amount. Rounded to 2 decimals.
 */
export function refundReversal(
  grossAmount: number,
  sellerAmount: number,
  commission: number,
  refundAmount: number,
): { sellerReversal: number; commissionGiveback: number; fraction: number } {
  const fraction = grossAmount > 0 ? Math.min(1, refundAmount / grossAmount) : 1;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    fraction,
    sellerReversal: round2(sellerAmount * fraction),
    commissionGiveback: round2(commission * fraction),
  };
}

/** Compute the rupee discount for an order amount. Never exceeds the amount. */
export function computeDiscount(
  discountType: "percentage" | "fixed",
  discountValue: number,
  amount: number,
  maxDiscount: number | null,
): number {
  let discount =
    discountType === "percentage"
      ? Math.round(((amount * discountValue) / 100) * 100) / 100
      : discountValue;
  if (maxDiscount != null) discount = Math.min(discount, maxDiscount);
  return Math.min(discount, amount); // never discount more than the amount itself
}
