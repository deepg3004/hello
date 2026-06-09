// Hero title boxes were removed across the seller + admin dashboards — the page
// title already lives in the topbar, so the hero was a redundant, space-heavy
// box that crowded smaller screens. This component now renders ONLY its actions
// slot (export buttons, stat chips, etc.) as a plain right-aligned row, so the
// ~45 existing callers keep compiling and their action buttons survive. With no
// children it renders nothing. (title/blurb/gradient/resourcesHref are accepted
// for back-compat but no longer shown.)

export function DashboardHero({
  children,
}: {
  title?: string;
  blurb?: string;
  /** @deprecated no longer rendered. */
  gradient?: string;
  /** @deprecated no longer rendered. */
  resourcesHref?: string | null;
  children?: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
  );
}
