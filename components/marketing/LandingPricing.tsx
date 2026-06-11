import { Check } from "lucide-react";

import { PLANS, type PlanKey } from "@/lib/plans";
import { cn } from "@/lib/utils";

// Human-readable highlight bullets per tier (derived from the feature flags in
// lib/plans, written for buyers rather than as raw flag names).
const HIGHLIGHTS: Record<PlanKey, string[]> = {
  free: ["Up to 3 pages", "Payment & checkout", "Basic analytics"],
  starter: [
    "Up to 10 pages",
    "All page types + lead magnets",
    "Telegram VIP access",
    "Email notifications",
  ],
  pro: [
    "Unlimited pages",
    "Coupons & abandoned-cart recovery",
    "A/B testing & social proof",
    "Custom subdomain + GST invoices",
  ],
  business: [
    "Everything in Pro",
    "Affiliate program",
    "Custom domain + API access",
    "Lower commission & priority support",
  ],
};

const ORDER: PlanKey[] = ["free", "starter", "pro", "business"];

/** Pricing grid driven by lib/plans — the single source of truth. */
export function LandingPricing() {
  return (
    <section id="pricing" className="relative">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="th-label text-[hsl(var(--brand-purple))]">Pricing</p>
          <h2 className="mt-2 font-sora text-3xl font-bold tracking-tight sm:text-4xl">
            Simple plans that scale with you
          </h2>
          <p className="mt-3 text-muted-foreground">
            Transparent pricing that grows with you — no lock-in.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {ORDER.map((key) => {
            const plan = PLANS[key];
            const popular = !!plan.popular;
            return (
              <div
                key={key}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-md dark:bg-card/80 dark:backdrop-blur-xl",
                  popular
                    ? "border-transparent ring-2 ring-[hsl(var(--brand-purple))] dark:shadow-glow"
                    : "border-border",
                )}
              >
                {popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-semibold text-white shadow-card">
                    Most popular
                  </span>
                )}
                <h3 className="font-sora text-lg font-semibold tracking-tight">
                  {plan.name}
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-sora text-4xl font-bold tracking-tight">
                    ₹{plan.price.toLocaleString("en-IN")}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {plan.price === 0 ? "forever" : "/mo"}
                  </span>
                </div>

                <ul className="mt-6 space-y-2.5 text-sm">
                  {HIGHLIGHTS[key].map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand-purple))]" />
                      <span className="text-muted-foreground">{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
