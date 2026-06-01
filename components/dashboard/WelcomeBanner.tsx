"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ArrowRight, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import { dismissWelcomeBannerAction } from "@/actions/onboarding";

interface Step {
  label: string;
  done: boolean;
}

interface Props {
  /** First name (or full name) — appears in "Welcome to InvoxAI, {name}! 👋". */
  name: string;
  /** 0–100. */
  progress: number;
  /** First incomplete step's CTA — gives the banner forward momentum. */
  next: {
    label: string;
    href: string;
  } | null;
  /** Optional onboarding checklist — renders as small ✓ chips under the
   *  progress bar. Omit (or pass empty) to hide the chip row. */
  steps?: Step[];
}

export function WelcomeBanner({ name, progress, next, steps = [] }: Props) {
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

  // First-name only feels personal; full names get long fast on the banner.
  const firstName = (name ?? "").trim().split(/\s+/)[0] || "there";

  return (
    <div className="card-surface animate-in-up relative overflow-hidden p-6">
      {/* Close X */}
      <button
        type="button"
        onClick={dismiss}
        disabled={pending}
        aria-label="Dismiss welcome banner"
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        {/* Left — copy + progress + checklist chips */}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Get started
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight text-foreground">
            Welcome to InvoxAI, {firstName}! <span aria-hidden>👋</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete your setup to start accepting payments.
          </p>

          {/* Progress — #111 fill on #D9D7D2 track (theme tokens) */}
          <div className="mt-4 max-w-md">
            <div className="flex items-center justify-between text-[12px] font-medium text-foreground">
              <span>You&apos;re {progress}% set up</span>
              {progress >= 100 && <span className="text-muted-foreground">All done</span>}
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "hsl(var(--progress-track))" }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.max(0, Math.min(100, progress))}%`,
                  backgroundColor: "hsl(var(--progress-fill))",
                }}
              />
            </div>
          </div>

          {/* Checklist chips — done = filled, pending = outlined dot */}
          {steps.length > 0 && (
            <ul className="mt-4 flex flex-wrap items-center gap-2">
              {steps.map((s, i) => (
                <li
                  key={i}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                    s.done
                      ? "border-transparent bg-secondary text-foreground"
                      : "border-border text-muted-foreground",
                  ].join(" ")}
                >
                  {s.done ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span className="block h-2.5 w-2.5 rounded-full border border-muted-foreground/50" />
                  )}
                  {s.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right — charcoal-black CTA */}
        {next && (
          <div className="shrink-0 md:self-end">
            <Button asChild size="lg">
              <Link href={next.href}>
                {next.label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
