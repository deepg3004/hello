// =============================================================================
// Onboarding state — pure computation, safe to import on the client.
//
// "Onboarded" = at least the profile + first page are done. KYC + bank are
// optional skip-able steps; sellers can come back later. The dashboard
// welcome banner stays until profile.onboarded_at is set (auto-stamped when
// step 1 + 3 are done) OR profile.welcome_dismissed_at is set.
// =============================================================================

export type OnboardingStepKey = "profile" | "kyc" | "page" | "payouts";

export interface OnboardingProfile {
  /** From user_profiles. */
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  /** ≥1 of (PAN verified, bank verified) — drives the KYC step. */
  kyc_level?: number | null;
  bank_verified?: boolean | null;
  razorpay_linked_account_id?: string | null;
  onboarded_at?: string | null;
  welcome_dismissed_at?: string | null;
  /** Total pages — drives the "first page" step. */
  pages_count: number;
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
      key: "page",
      index: 2,
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
