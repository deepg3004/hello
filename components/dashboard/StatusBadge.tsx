import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Maps every status string used across the app to one of four visual
 * groups defined in app/globals.css:
 *
 *   badge-success → green   (paid, active, approved, completed, published, …)
 *   badge-pending → amber   (pending, processing, trialing, paused, queued, …)
 *   badge-failed  → red     (failed, rejected, expired, cancelled, …)
 *   badge-info    → indigo  (draft, inactive, refunded, archived, fallback)
 *
 * Unknown statuses fall back to `badge-info` so a new lifecycle state never
 * renders unstyled. Keep this mapping table in sync with new statuses added
 * to the DB CHECK constraints.
 */
const GROUP_BY_STATUS: Record<
  string,
  "badge-success" | "badge-pending" | "badge-failed" | "badge-info"
> = {
  // success
  paid: "badge-success",
  active: "badge-success",
  approved: "badge-success",
  completed: "badge-success",
  published: "badge-success",
  delivered: "badge-success",
  succeeded: "badge-success",

  // pending / in-flight
  pending: "badge-pending",
  processing: "badge-pending",
  trialing: "badge-pending",
  paused: "badge-pending",
  queued: "badge-pending",
  invited: "badge-pending",
  in_progress: "badge-pending",
  initiated: "badge-pending",
  scheduled: "badge-pending",

  // failed / hard-stop
  failed: "badge-failed",
  rejected: "badge-failed",
  expired: "badge-failed",
  cancelled: "badge-failed",
  canceled: "badge-failed",
  removed: "badge-failed",
  declined: "badge-failed",

  // info / neutral
  draft: "badge-info",
  inactive: "badge-info",
  archived: "badge-info",
  refunded: "badge-info",
  partially_refunded: "badge-info",
  open: "badge-info",
  unverified: "badge-info",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const group = GROUP_BY_STATUS[status] ?? "badge-info";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        group,
        className,
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
