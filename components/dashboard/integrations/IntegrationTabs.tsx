"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Hash } from "lucide-react";

import { cn } from "@/lib/utils";

// Group Integrations hub tabs. Telegram is live today; Discord lands in a later
// session, so it shows as a disabled "Soon" tab to signal the roadmap without a
// dead link. New providers slot in here as additional entries.
interface TabDef {
  key: string;
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Matches the active tab when the pathname starts with this prefix. */
  match: string;
  soon?: boolean;
}

const TABS: TabDef[] = [
  {
    key: "telegram",
    label: "Telegram",
    href: "/dashboard/telegram",
    Icon: MessageCircle,
    match: "/dashboard/telegram",
  },
  {
    key: "discord",
    label: "Discord",
    href: "/dashboard/discord",
    Icon: Hash,
    match: "/dashboard/discord",
  },
];

export function IntegrationTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-5 flex items-center gap-1 border-b border-border">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.match);
        if (t.soon) {
          return (
            <span
              key={t.key}
              aria-disabled
              title="Coming soon"
              className={cn(
                "inline-flex cursor-not-allowed items-center gap-1.5 border-b-2 border-transparent",
                "px-3 py-2 text-sm font-medium text-muted-foreground/50",
              )}
            >
              <t.Icon className="h-4 w-4" />
              {t.label}
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            </span>
          );
        }
        return (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
