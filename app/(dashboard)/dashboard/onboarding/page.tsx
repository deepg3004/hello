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
import { platformRootDomain } from "@/lib/domains";
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
  const [{ data: profile }, { count: pagesCount }, { count: gatewayCount }, { count: paidCount }] =
    await Promise.all([
      admin
        .from("user_profiles")
        .select(
          "full_name, phone, avatar_url, onboarded_at, welcome_dismissed_at, creator_category, subdomain",
        )
        .eq("id", user.id)
        .single(),
      admin
        .from("pages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      admin
        .from("seller_gateway_config")
        .select("id", { count: "exact", head: true })
        .eq("seller_user_id", user.id)
        .eq("is_active", true),
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("seller_user_id", user.id)
        .eq("status", "paid"),
    ]);

  const steps = buildOnboardingSteps({
    full_name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    avatar_url: profile?.avatar_url ?? null,
    onboarded_at: profile?.onboarded_at ?? null,
    welcome_dismissed_at: profile?.welcome_dismissed_at ?? null,
    creator_category: profile?.creator_category ?? null,
    pages_count: pagesCount ?? 0,
    gateway_connected: (gatewayCount ?? 0) > 0,
    paid_orders_count: paidCount ?? 0,
  });

  const progress = computeOnboardingProgress(steps);
  const complete = isOnboardingComplete(steps);

  const subdomain = profile?.subdomain ?? null;
  const storeUrl = subdomain
    ? `https://${subdomain}.${platformRootDomain()}`
    : null;

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

      {/* Store address — every seller gets a subdomain automatically; this is
          where they can see it and claim a custom one. */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your store address</CardTitle>
          <CardDescription>
            Every link you create — payment, leads, store, Telegram, courses —
            lives here. Share this one address with your audience.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          {storeUrl ? (
            <code className="truncate rounded-md bg-background px-3 py-2 text-sm font-medium">
              {subdomain}.{platformRootDomain()}
            </code>
          ) : (
            <span className="text-sm text-muted-foreground">
              Setting up your address…
            </span>
          )}
          <div className="flex gap-2">
            {storeUrl && (
              <Button asChild variant="outline">
                <a href={storeUrl} target="_blank" rel="noreferrer">
                  Visit store
                </a>
              </Button>
            )}
            <Button asChild>
              <Link href="/dashboard/settings/domains">Claim / change address</Link>
            </Button>
          </div>
        </CardContent>
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
