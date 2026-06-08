import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Premium, on-brand empty state: an indigo icon chip, title, description and an
 * optional CTA, on a soft dashed glass panel. Use anywhere there's "no data
 * yet" instead of a plain sentence.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-4 font-sora text-base font-semibold text-foreground">
        {title}
      </p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
