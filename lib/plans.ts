// =============================================================================
// InvoxAI — subscription plans
//
// Source of truth for plan pricing, page limits, feature flags, and commission
// discounts. Used by:
//   - lib/subscription-gate.ts   (server-side feature gates)
//   - hooks/useSubscription.ts   (client-side feature checks)
//   - app/(dashboard)/dashboard/upgrade/page.tsx
//   - app/api/subscriptions/create/route.ts
//
// Fill in razorpay_plan_id values once you create the plans in the Razorpay
// dashboard (Subscriptions → Plans).
// =============================================================================

export type PlanKey = "free" | "starter" | "pro" | "business";

export type Feature =
  // free tier
  | "basic_pages"
  | "basic_analytics"
  // starter tier
  | "all_pages"
  | "analytics"
  | "telegram_vip"
  | "lead_magnet"
  | "email_notifications"
  // pro tier
  | "everything_starter"
  | "custom_subdomain"
  | "coupon_codes"
  | "abandoned_checkout"
  | "social_proof"
  | "pixel_manager"
  | "a_b_testing"
  | "whatsapp_alerts"
  | "gst_invoices"
  // business tier
  | "everything_pro"
  | "affiliate_system"
  | "priority_support"
  | "custom_domain"
  | "api_access"
  | "lower_commission";

export interface Plan {
  key: PlanKey;
  name: string;
  price: number;                       // monthly INR (rupees, not paise)
  razorpay_plan_id?: string;           // fill in from Razorpay dashboard
  pages: number;                       // -1 = unlimited
  wallet_fee_paise: number;            // platform fee per completed order, in paise
  commission_discount?: number;        // percentage points off platform commission
  features: Feature[];
  popular?: boolean;                   // highlighted on pricing page
}

export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: "free",
    name: "Free",
    price: 0,
    pages: 3,
    wallet_fee_paise: 2000, // ₹20 per order
    features: ["basic_pages", "basic_analytics"],
  },
  starter: {
    key: "starter",
    name: "Starter",
    price: 499,
    razorpay_plan_id: "",
    pages: 10,
    wallet_fee_paise: 1200, // ₹12 per order
    features: [
      "all_pages",
      "analytics",
      "telegram_vip",
      "lead_magnet",
      "email_notifications",
    ],
  },
  pro: {
    key: "pro",
    name: "Pro",
    price: 999,
    razorpay_plan_id: "",
    pages: -1,
    wallet_fee_paise: 700, // ₹7 per order
    popular: true,
    features: [
      "everything_starter",
      "custom_subdomain",
      "coupon_codes",
      "abandoned_checkout",
      "social_proof",
      "pixel_manager",
      "a_b_testing",
      "whatsapp_alerts",
      "gst_invoices",
    ],
  },
  business: {
    key: "business",
    name: "Business",
    price: 1999,
    razorpay_plan_id: "",
    pages: -1,
    wallet_fee_paise: 300, // ₹3 per order
    commission_discount: 2,
    features: [
      "everything_pro",
      "affiliate_system",
      "priority_support",
      "custom_domain",
      "api_access",
      "lower_commission",
    ],
  },
};

// "everything_starter" / "everything_pro" mean "inherits everything from the
// tier below". This map flattens that inheritance so feature checks are O(1).
const INHERITANCE: Record<string, PlanKey> = {
  everything_starter: "starter",
  everything_pro: "pro",
};

function flattenFeatures(planKey: PlanKey, seen = new Set<PlanKey>()): Set<Feature> {
  if (seen.has(planKey)) return new Set();
  seen.add(planKey);
  const out = new Set<Feature>();
  for (const f of PLANS[planKey].features) {
    if (f in INHERITANCE) {
      for (const inherited of flattenFeatures(INHERITANCE[f], seen)) {
        out.add(inherited);
      }
    } else {
      out.add(f as Feature);
    }
  }
  return out;
}

// Materialised feature sets — computed once on module load.
export const PLAN_FEATURES: Record<PlanKey, Set<Feature>> = {
  free: flattenFeatures("free"),
  starter: flattenFeatures("starter"),
  pro: flattenFeatures("pro"),
  business: flattenFeatures("business"),
};

/** Does this plan include this feature? */
export function planHasFeature(plan: PlanKey, feature: Feature): boolean {
  return PLAN_FEATURES[plan].has(feature);
}

/** Cheapest plan that unlocks `feature`, or null if no plan offers it. */
export function minimumPlanForFeature(feature: Feature): PlanKey | null {
  const order: PlanKey[] = ["free", "starter", "pro", "business"];
  for (const p of order) {
    if (planHasFeature(p, feature)) return p;
  }
  return null;
}

/** Page-count check. `current` is the user's existing page count. */
export function canCreateMorePages(plan: PlanKey, current: number): boolean {
  const limit = PLANS[plan].pages;
  return limit === -1 || current < limit;
}

/** Effective commission percent for this plan, given the platform default. */
export function effectiveCommissionPercent(
  plan: PlanKey,
  platformDefaultPercent: number,
): number {
  const discount = PLANS[plan].commission_discount ?? 0;
  return Math.max(0, platformDefaultPercent - discount);
}

/**
 * Resolve the commission percent actually charged, honouring the admin's
 * per-plan override map when it has an entry for this plan. Map values are
 * ABSOLUTE percents (e.g. {"pro": 3.5}); anything missing/invalid falls back
 * to the plan's compiled-in discount via effectiveCommissionPercent(). Pure
 * so it stays unit-testable and free of the settings/DB dependency.
 */
export function resolveCommissionPercent(
  plan: PlanKey,
  platformDefaultPercent: number,
  perPlanMap?: Record<string, number> | null,
): number {
  const override = perPlanMap?.[plan];
  if (typeof override === "number" && Number.isFinite(override)) {
    return Math.min(100, Math.max(0, override));
  }
  return effectiveCommissionPercent(plan, platformDefaultPercent);
}
