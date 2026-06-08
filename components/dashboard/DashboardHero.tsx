import Link from "next/link";
import { BookOpen } from "lucide-react";

/**
 * Page header ("title box") shared across the dashboards (Transactions,
 * Customers, Leads, Coupons, Pages…). Compact premium glass panel: a clean
 * title + blurb on a translucent card with a subtle indigo glow and a brand
 * accent rail — tuned for the dark theme (no loud multi-colour banner). An
 * optional actions slot (e.g. an export button) sits on the right.
 *
 * The legacy `gradient` prop is accepted for back-compat but no longer used —
 * every page now gets one consistent, calm header.
 */
export function DashboardHero({
  title,
  blurb,
  resourcesHref = "/dashboard/learn",
  children,
}: {
  title: string;
  blurb: string;
  /** @deprecated no longer used — kept so existing callers still compile. */
  gradient?: string;
  /** Set to null to hide the Resources link. */
  resourcesHref?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card/70 p-5 shadow-card backdrop-blur-xl dark:ring-1 dark:ring-inset dark:ring-white/[0.06] sm:p-6">
      {/* Brand accent rail on the left edge. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-brand-gradient"
      />
      {/* Soft indigo glow — depth without a loud colour wash. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/15 blur-3xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4 pl-2">
        <div className="min-w-0">
          <h1 className="font-sora text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {blurb}
          </p>
          {resourcesHref && (
            <Link
              href={resourcesHref}
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Resources
            </Link>
          )}
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        )}
      </div>
    </div>
  );
}
