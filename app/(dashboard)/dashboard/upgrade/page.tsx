"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";

import { startUpgradeAction } from "@/actions/subscriptions";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLANS, type PlanKey } from "@/lib/plans";
import { cn } from "@/lib/utils";

const FEATURE_LABELS: Record<string, string> = {
  basic_pages: "Basic page templates",
  basic_analytics: "Basic analytics",
  all_pages: "All page templates",
  analytics: "Advanced analytics",
  telegram_vip: "Telegram VIP groups",
  lead_magnet: "Lead magnets",
  email_notifications: "Email notifications",
  everything_starter: "Everything in Starter",
  custom_subdomain: "Custom subdomains",
  coupon_codes: "Coupon codes",
  abandoned_checkout: "Abandoned-checkout recovery",
  social_proof: "Social proof widgets",
  pixel_manager: "Pixel manager",
  a_b_testing: "A/B testing",
  whatsapp_alerts: "WhatsApp alerts",
  gst_invoices: "GST invoices",
  everything_pro: "Everything in Pro",
  affiliate_system: "Affiliate system",
  priority_support: "Priority support",
  custom_domain: "Custom domains",
  api_access: "API access",
  lower_commission: "2% lower platform commission",
};

const SELECTABLE: PlanKey[] = ["starter", "pro", "business"];

function UpgradeInner() {
  const { plan: currentPlan, loading } = useSubscription();
  const params = useSearchParams();
  const required = params.get("required") as PlanKey | null;
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState<PlanKey | null>(null);

  async function onUpgrade(plan: PlanKey) {
    setSubmitting(plan);
    const result = await startUpgradeAction({ plan });
    if (!result.ok) {
      setSubmitting(null);
      toast({
        title: "Couldn't start the upgrade",
        description: result.message,
        variant: "destructive",
      });
      return;
    }
    window.location.href = result.redirectUrl!;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-sora font-semibold tracking-tight">Choose your plan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cancel anytime. Prices in INR, billed monthly.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {SELECTABLE.map((key) => {
          const plan = PLANS[key];
          const isCurrent = currentPlan === key;
          const isRequired = required === key;
          const isPopular = plan.popular;
          return (
            <Card
              key={key}
              className={cn(
                "flex flex-col",
                (isPopular || isRequired) && "border-primary shadow-lg",
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {isPopular && (
                    <Badge variant="default" className="gap-1">
                      <Sparkles className="h-3 w-3" /> Popular
                    </Badge>
                  )}
                  {isRequired && !isPopular && <Badge>Required</Badge>}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold">₹{plan.price}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <CardDescription>
                  {plan.pages === -1
                    ? "Unlimited pages"
                    : `Up to ${plan.pages} pages`}
                  {plan.commission_discount
                    ? ` · ${plan.commission_discount}% lower commission`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{FEATURE_LABELS[f] ?? f.replace(/_/g, " ")}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isCurrent ? (
                  <Button className="w-full" variant="outline" disabled>
                    Current plan
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => onUpgrade(key)}
                    disabled={loading || submitting !== null}
                  >
                    {submitting === key && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Upgrade to {plan.name}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Free plan includes {PLANS.free.pages} pages. You&apos;ll be charged
        through Razorpay. Cancel from your dashboard anytime.
      </p>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<UpgradeSkeleton />}>
      <UpgradeInner />
    </Suspense>
  );
}

function UpgradeSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-sora font-semibold tracking-tight">Choose your plan</h1>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {SELECTABLE.map((k) => (
          <Card key={k} className="h-96 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
