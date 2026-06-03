import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildOnboardingSteps,
  computeOnboardingProgress,
  isOnboardingComplete,
} from "@/lib/onboarding";
import { OnboardingControls } from "@/components/dashboard/OnboardingControls";

export const metadata = { title: "Get started · InvoxAI" };

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/onboarding");

  const admin = createAdminClient();
  const [{ data: profile }, { count: pagesCount }] = await Promise.all([
    admin
      .from("user_profiles")
      .select(
        "full_name, phone, avatar_url, kyc_level, bank_verified, razorpay_linked_account_id, onboarded_at, welcome_dismissed_at",
      )
      .eq("id", user.id)
      .single(),
    admin
      .from("pages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const steps = buildOnboardingSteps({
    full_name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    avatar_url: profile?.avatar_url ?? null,
    kyc_level: profile?.kyc_level ?? null,
    bank_verified: profile?.bank_verified ?? null,
    razorpay_linked_account_id: profile?.razorpay_linked_account_id ?? null,
    onboarded_at: profile?.onboarded_at ?? null,
    welcome_dismissed_at: profile?.welcome_dismissed_at ?? null,
    pages_count: pagesCount ?? 0,
  });

  const progress = computeOnboardingProgress(steps);
  const complete = isOnboardingComplete(steps);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">
          Welcome to InvoxAI
        </h1>
        <p className="text-sm text-muted-foreground">
          A short checklist gets you live and earning. Skip the optional steps
          for now — you can finish them any time from the dashboard.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Your progress</CardTitle>
            <Badge variant={complete ? "default" : "outline"}>
              {progress}%
            </Badge>
          </div>
          <Progress value={progress} className="mt-2" />
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {steps.map((step) => (
          <Card
            key={step.key}
            className={step.done ? "border-emerald-200 dark:border-emerald-500/30" : undefined}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    Step {step.index} · {step.title}
                    {step.skippable && !step.done && (
                      <Badge variant="outline" className="text-xs">
                        Optional
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            {!step.done && (
              <CardContent className="flex flex-wrap items-center gap-2 pt-0">
                <Button asChild>
                  <Link href={step.cta_href}>{step.cta_label}</Link>
                </Button>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <OnboardingControls
        complete={complete}
        onboardedAt={profile?.onboarded_at ?? null}
      />
    </div>
  );
}
