// =============================================================================
// Onboarding state — pure computation, safe to import on the client.
//
// "Onboarded" = at least the profile + first page are done. Category is an
// optional skip-able step; sellers can come back later. The dashboard
// welcome banner stays until profile.onboarded_at is set (auto-stamped when
// step 1 + 3 are done) OR profile.welcome_dismissed_at is set.
// =============================================================================

export type OnboardingStepKey =
  | "profile"
  | "category"
  | "page"
  | "gateway"
  | "sale";

export interface OnboardingProfile {
  /** From user_profiles. */
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  onboarded_at?: string | null;
  welcome_dismissed_at?: string | null;
  /** Self-selected niche — drives the "category" step. */
  creator_category?: string | null;
  /** Total pages — drives the "first page" step. */
  pages_count: number;
  /** Seller has an active payment gateway connected — drives "gateway" step. */
  gateway_connected?: boolean;
  /** Count of paid orders — drives the "first sale" step. */
  paid_orders_count?: number;
}

export interface OnboardingStep {
  key: OnboardingStepKey;
  index: number;
  title: string;
  description: string;
  cta_label: string;
  cta_href: string;
  done: boolean;
  /** Skip-able steps still count toward "complete" when skipped. */
  skippable: boolean;
}

export function buildOnboardingSteps(
  profile: OnboardingProfile,
): OnboardingStep[] {
  return [
    {
      key: "profile",
      index: 1,
      title: "Complete your profile",
      description:
        "Add your name, phone number, and avatar — buyers and our team see these on receipts and support tickets.",
      cta_label: "Open settings",
      cta_href: "/dashboard/settings",
      done: profileDone(profile),
      skippable: false,
    },
    {
      key: "category",
      index: 2,
      title: "Pick your creator category",
      description:
        "Tell us your niche so we can tailor templates and tips to your business. You can change it any time in Settings.",
      cta_label: "Choose category",
      cta_href: "/dashboard/settings",
      done: !!profile.creator_category,
      skippable: true,
    },
    {
      key: "page",
      index: 3,
      title: "Create your first page",
      description:
        "Pick a template, name your product, hit Publish. Pre-filled defaults so you can be live in 60 seconds.",
      cta_label: profile.pages_count > 0 ? "Open editor" : "Create page",
      cta_href:
        profile.pages_count > 0
          ? "/dashboard/pages"
          : "/dashboard/pages/new",
      done: profile.pages_count > 0,
      skippable: false,
    },
    {
      key: "gateway",
      index: 4,
      title: "Connect your payment gateway",
      description:
        "Add your own Razorpay or Cashfree keys so payments go straight to your account. You can't take a payment until this is connected.",
      cta_label: "Connect gateway",
      cta_href: "/dashboard/settings/gateway",
      done: !!profile.gateway_connected,
      // Skippable for completion accounting only — it's the real unlock to sell.
      skippable: true,
    },
    {
      key: "sale",
      index: 5,
      title: "Make your first sale 🎉",
      description:
        "Share your page link with your audience. Your first sale is the milestone that matters — everything else is setup.",
      cta_label: (profile.paid_orders_count ?? 0) > 0 ? "View sales" : "Share my page",
      cta_href:
        (profile.paid_orders_count ?? 0) > 0 ? "/dashboard/insights" : "/dashboard/pages",
      done: (profile.paid_orders_count ?? 0) > 0,
      skippable: true,
    },
  ];
}

export function profileDone(p: OnboardingProfile): boolean {
  return (
    !!p.full_name?.trim() && !!p.phone?.trim() && !!p.avatar_url?.trim()
  );
}

export function computeOnboardingProgress(
  steps: OnboardingStep[],
): number {
  const total = steps.length;
  const done = steps.filter((s) => s.done).length;
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

export function isOnboardingComplete(steps: OnboardingStep[]): boolean {
  // Required steps must be done; skippable steps count as done OR skipped.
  return steps.every((s) => s.done || s.skippable);
}

export function shouldShowWelcomeBanner(
  profile: OnboardingProfile,
): boolean {
  if (profile.welcome_dismissed_at) return false;
  if (profile.onboarded_at) return false;
  return true;
}
