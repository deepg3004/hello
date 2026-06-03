import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Gradient hero banner shared across the section dashboards (Transactions,
 * Customers, Leads, Coupons, Pages…). Renders a title + blurb on the left and
 * an optional actions slot (e.g. an export button) on the right.
 *
 * Colour: pass an explicit `gradient` (Tailwind `from-… via-… to-…` classes)
 * for an intentional, feature-fitting banner. If omitted, a vibrant gradient is
 * derived deterministically from the title so every page still gets its own
 * distinct colour instead of a flat black panel.
 */

// Vibrant, premium gradient palette — one per feature "lane".
const HERO_GRADIENTS = [
  "from-indigo-600 via-blue-600 to-cyan-600",
  "from-violet-600 via-purple-600 to-fuchsia-600",
  "from-emerald-600 via-teal-600 to-green-600",
  "from-amber-500 via-orange-500 to-rose-500",
  "from-sky-600 via-indigo-600 to-violet-600",
  "from-rose-600 via-pink-600 to-fuchsia-600",
  "from-cyan-600 via-sky-600 to-blue-600",
  "from-fuchsia-600 via-purple-600 to-indigo-600",
] as const;

// Stable hash so the same feature name always maps to the same colour.
function gradientForTitle(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) {
    h = (Math.imul(h, 31) + title.charCodeAt(i)) >>> 0;
  }
  return HERO_GRADIENTS[h % HERO_GRADIENTS.length]!;
}

export function DashboardHero({
  title,
  blurb,
  gradient,
  resourcesHref = "/dashboard/learn",
  children,
}: {
  title: string;
  blurb: string;
  /** Tailwind gradient classes, e.g. "from-indigo-600 via-blue-600 to-cyan-600".
   *  Omit to auto-derive a distinct colour from the title. */
  gradient?: string;
  /** Set to null to hide the Resources link. */
  resourcesHref?: string | null;
  children?: React.ReactNode;
}) {
  const bg = gradient ?? gradientForTitle(title);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br p-6 text-white shadow-card-lg ring-1 ring-white/15 sm:p-8",
        bg,
      )}
    >
      {/* Glossy sheen + depth — light blob top-right, soft dark wash bottom. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/4 h-44 w-44 rounded-full bg-black/20 blur-3xl"
      />
      {/* Subtle top highlight line for a premium glass edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-sora text-2xl font-bold tracking-tight drop-shadow-sm sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 max-w-md text-sm text-white/80">{blurb}</p>
          {resourcesHref && (
            <Link
              href={resourcesHref}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-white/85 underline-offset-2 hover:text-white hover:underline"
            >
              📖 Resources
            </Link>
          )}
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
    </div>
  );
}
