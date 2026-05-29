"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import {
  PLANS,
  PLAN_FEATURES,
  minimumPlanForFeature,
  type Feature,
  type PlanKey,
} from "@/lib/plans";

interface UseSubscriptionResult {
  loading: boolean;
  plan: PlanKey;
  status: string;
  /** Returns true if the current plan unlocks `feature`. */
  hasFeature: (feature: Feature) => boolean;
  /** Returns the cheapest plan that unlocks `feature`. */
  requiredPlanFor: (feature: Feature) => PlanKey | null;
  /** Push to /dashboard/upgrade, optionally pinning the required plan. */
  redirectToPricing: (requiredFeature?: Feature) => void;
}

const PAID_GRANTING_STATUSES = new Set(["active", "trialing"]);

export function useSubscription(): UseSubscriptionResult {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PlanKey>("free");
  const [status, setStatus] = useState<string>("inactive");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("user_profiles")
        .select("subscription_plan, subscription_status")
        .eq("id", user.id)
        .single();

      if (!cancelled) {
        const rawPlan = (data?.subscription_plan ?? "free") as string;
        const resolved: PlanKey = (rawPlan in PLANS ? rawPlan : "free") as PlanKey;
        const resolvedStatus = (data?.subscription_status ?? "inactive") as string;

        // Paid plan only effective while subscription is active/trialing.
        const effectivePlan: PlanKey =
          resolved === "free" || PAID_GRANTING_STATUSES.has(resolvedStatus)
            ? resolved
            : "free";

        setPlan(effectivePlan);
        setStatus(resolvedStatus);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasFeature = useCallback(
    (feature: Feature) => PLAN_FEATURES[plan].has(feature),
    [plan],
  );

  const requiredPlanFor = useCallback(
    (feature: Feature) => minimumPlanForFeature(feature),
    [],
  );

  const redirectToPricing = useCallback(
    (requiredFeature?: Feature) => {
      if (requiredFeature) {
        const req = minimumPlanForFeature(requiredFeature);
        router.push(`/dashboard/upgrade${req ? `?required=${req}` : ""}`);
      } else {
        router.push("/dashboard/upgrade");
      }
    },
    [router],
  );

  return { loading, plan, status, hasFeature, requiredPlanFor, redirectToPricing };
}
