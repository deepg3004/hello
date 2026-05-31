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
    <div
      className={[
        "animate-in-up relative overflow-hidden rounded-2xl",
        "bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700",
        "p-6 text-white shadow-lg shadow-indigo-900/20",
      ].join(" ")}
    >
      {/* Decorative ambient blob — purely cosmetic, doesn't block clicks */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl"
      />

      {/* Close X */}
      <button
        type="button"
        onClick={dismiss}
        disabled={pending}
        aria-label="Dismiss welcome banner"
        className="absolute right-3 top-3 rounded-md p-1 text-white/70 transition hover:bg-white/15 hover:text-white disabled:opacity-50"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        {/* Left — copy + progress + checklist chips */}
        <div className="min-w-0 flex-1">
          <h2 className="font-sora text-2xl font-semibold leading-tight tracking-tight text-white">
            Welcome to InvoxAI, {firstName}! <span aria-hidden>👋</span>
          </h2>
          <p className="mt-1 text-sm text-white/80">
            Complete your setup to start accepting payments.
          </p>

          {/* Progress bar — white/30 track + white fill */}
          <div className="mt-4 max-w-md">
            <div className="flex items-center justify-between text-[11px] font-medium text-white/80">
              <span>You&apos;re {progress}% set up</span>
              {progress >= 100 && <span>All done</span>}
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border"
            >
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{
                  backgroundColor: "hsl(220 30% 15%)",
                  width: `${Math.max(0, Math.min(100, progress))}%`,
                }}
              />
            </div>
          </div>

          {/* Checklist chips — done ones get a check + opacity, pending ones
              get a tiny outlined circle. Hidden when no steps are passed. */}
          {steps.length > 0 && (
            <ul className="mt-4 flex flex-wrap items-center gap-2">
              {steps.map((s, i) => (
                <li
                  key={i}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full",
                    "px-2.5 py-1 text-[11px] font-medium",
                    s.done
                      ? "bg-white/20 text-white"
                      : "bg-white/10 text-white/70",
                  ].join(" ")}
                >
                  {s.done ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span className="block h-2.5 w-2.5 rounded-full border border-white/60" />
                  )}
                  {s.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right — primary CTA */}
        {next && (
          <div className="shrink-0 md:self-end">
            <Button
              asChild
              size="lg"
              className="bg-white font-medium text-indigo-700 shadow-md hover:bg-white/90"
            >
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
