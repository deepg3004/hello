// Pure pricing math — kept dependency-free so it's unit-testable in isolation
// (lib/coupons.ts pulls in the Supabase admin client, which can't load in tests).

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
