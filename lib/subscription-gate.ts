// =============================================================================
// Server-side feature gating.
//
// Usage in a server component or server action:
//
//   import { checkFeatureAccess } from "@/lib/subscription-gate";
//   const access = await checkFeatureAccess(userId, "coupon_codes");
//   if (!access.allowed) redirect(`/dashboard/upgrade?required=${access.requiredPlan}`);
// =============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import {
  PLANS,
  PLAN_FEATURES,
  minimumPlanForFeature,
  type Feature,
  type PlanKey,
} from "@/lib/plans";

export interface FeatureAccess {
  allowed: boolean;
  /** The user's current plan as stored in user_profiles. */
  currentPlan: PlanKey;
  /** The current subscription_status. */
  currentStatus: string;
  /**
   * The cheapest plan that unlocks the requested feature. `null` if the
   * feature doesn't exist on any plan.
   */
  requiredPlan: PlanKey | null;
}

const STATUSES_THAT_GRANT_PAID_ACCESS = new Set([
  "active",
  "trialing",
  // past_due intentionally NOT here — grace handling lives elsewhere.
]);

/**
 * Returns whether a user has access to a given feature.
 *
 * Uses the service-role admin client so it works from server contexts
 * regardless of which auth client the caller is holding.
 */
export async function checkFeatureAccess(
  userId: string,
  feature: Feature,
): Promise<FeatureAccess> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_profiles")
    .select("subscription_plan, subscription_status")
    .eq("id", userId)
    .single();

  if (error || !data) {
    // No profile row → treat as free tier so we still gate paid features.
    return {
      allowed: PLAN_FEATURES.free.has(feature),
      currentPlan: "free",
      currentStatus: "inactive",
      requiredPlan: minimumPlanForFeature(feature),
    };
  }

  const planRaw = (data.subscription_plan ?? "free") as string;
  const plan: PlanKey = (planRaw in PLANS ? planRaw : "free") as PlanKey;
  const status = data.subscription_status ?? "inactive";

  // Paid plans only grant access while the subscription is active/trialing.
  const effectivePlan: PlanKey =
    plan === "free" || STATUSES_THAT_GRANT_PAID_ACCESS.has(status)
      ? plan
      : "free";

  return {
    allowed: PLAN_FEATURES[effectivePlan].has(feature),
    currentPlan: effectivePlan,
    currentStatus: status,
    requiredPlan: minimumPlanForFeature(feature),
  };
}

/**
 * Throw-style variant for use inside server actions / route handlers when you
 * want to short-circuit on denied access.
 */
export async function assertFeatureAccess(
  userId: string,
  feature: Feature,
): Promise<void> {
  const access = await checkFeatureAccess(userId, feature);
  if (!access.allowed) {
    const err = new Error(
      `Feature "${feature}" requires the ${access.requiredPlan ?? "(none)"} plan`,
    );
    (err as Error & { code?: string }).code = "FEATURE_LOCKED";
    throw err;
  }
}
