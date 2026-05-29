"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PLANS, type Feature, type PlanKey } from "@/lib/plans";

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The feature that triggered the prompt (used for the headline). */
  feature?: Feature;
  /** Plan the user needs in order to unlock the feature. */
  requiredPlan: PlanKey;
  /** The plan they're currently on (for messaging). */
  currentPlan?: PlanKey;
}

const FEATURE_LABELS: Partial<Record<Feature, string>> = {
  basic_pages: "basic pages",
  basic_analytics: "basic analytics",
  all_pages: "all page templates",
  analytics: "advanced analytics",
  telegram_vip: "Telegram VIP groups",
  lead_magnet: "lead magnets",
  email_notifications: "email notifications",
  custom_subdomain: "custom subdomains",
  coupon_codes: "coupon codes",
  abandoned_checkout: "abandoned-checkout recovery",
  social_proof: "social proof widgets",
  pixel_manager: "the pixel manager",
  a_b_testing: "A/B testing",
  whatsapp_alerts: "WhatsApp alerts",
  gst_invoices: "GST invoices",
  affiliate_system: "the affiliate system",
  priority_support: "priority support",
  custom_domain: "custom domains",
  api_access: "API access",
  lower_commission: "lower platform commission",
};

export function UpgradePrompt({
  open,
  onOpenChange,
  feature,
  requiredPlan,
  currentPlan,
}: UpgradePromptProps) {
  const plan = PLANS[requiredPlan];
  const featureLabel = feature ? FEATURE_LABELS[feature] ?? feature : "this feature";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">
            Upgrade to {plan.name}
          </DialogTitle>
          <DialogDescription className="text-center">
            {featureLabel} is included in the <strong>{plan.name}</strong> plan
            {currentPlan ? `. You&apos;re currently on ${PLANS[currentPlan].name}.` : "."}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {plan.name}
            </span>
            <span className="text-2xl font-semibold">
              ₹{plan.price}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                /month
              </span>
            </span>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {plan.features.slice(0, 5).map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">✓</span>
                <span>{FEATURE_LABELS[f] ?? f.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          <Button asChild>
            <Link href={`/dashboard/upgrade?required=${requiredPlan}`}>
              View plans
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
