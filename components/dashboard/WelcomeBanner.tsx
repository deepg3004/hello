"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ArrowRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

import { dismissWelcomeBannerAction } from "@/actions/onboarding";

interface Props {
  /** 0–100. */
  progress: number;
  /** First incomplete step's CTA — gives the banner forward momentum. */
  next: {
    label: string;
    href: string;
  } | null;
}

export function WelcomeBanner({ progress, next }: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function dismiss() {
    startTransition(async () => {
      const res = await dismissWelcomeBannerAction();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't dismiss",
          description: res.message,
        });
      }
    });
  }

  return (
    <div className="relative overflow-hidden rounded-lg border bg-gradient-to-r from-primary/5 via-amber-50 to-primary/5 p-5 dark:from-primary/10 dark:via-amber-900/10 dark:to-primary/10">
      <button
        type="button"
        onClick={dismiss}
        disabled={pending}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Get started
          </p>
          <h3 className="mt-0.5 text-base font-semibold tracking-tight">
            You&apos;re {progress}% set up
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Finish onboarding to enable payouts and start collecting orders.
          </p>
          <Progress value={progress} className="mt-3 max-w-md" />
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {next && (
            <Button asChild>
              <Link href={next.href}>
                {next.label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/dashboard/onboarding">View checklist</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
