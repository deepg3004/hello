"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";

import { usePublicPageUrl } from "@/components/dashboard/SellerContext";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn, truncate } from "@/lib/utils";

interface RevenueBarsProps {
  rows: Array<{
    id: string;
    title: string;
    slug: string;
    type?: string | null;
    template_id?: string | null;
    total_revenue: number;
  }>;
}

/**
 * Top-pages list with animated revenue bars. Each row's fill grows from 0 →
 * target width on mount, staggered by 100ms per item so the eye reads them
 * in order.
 *
 * The animation is pure CSS — we flip `mounted` to true once on the client
 * after first paint, and the bars `transition` to their target widths.
 * Server-rendered initial markup ships width: 0 so there's no layout
 * flash if JS is slow.
 */
export function RevenueBars({ rows }: RevenueBarsProps) {
  const buildPageUrl = usePublicPageUrl();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // requestAnimationFrame ensures the 0%-width markup paints first, then
    // the transition to the real width kicks in on the next frame.
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No revenue yet"
        description="Top pages appear here once orders come in."
      />
    );
  }

  const max = Math.max(...rows.map((r) => r.total_revenue), 1);

  return (
    <ul className="space-y-3.5">
      {rows.map((r, i) => {
        const pct = Math.round((r.total_revenue / max) * 100);
        return (
          <li key={r.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <Link
                href={buildPageUrl(r.type, r.slug, r.template_id)}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-2 font-medium text-foreground hover:text-primary"
                title={r.title}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="truncate hover:underline">{truncate(r.title, 20)}</span>
              </Link>
              <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">
                ₹{r.total_revenue.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500",
                  "transition-[width] duration-700 ease-out",
                )}
                style={{
                  width: mounted ? `${pct}%` : "0%",
                  // Stagger each bar's start by 100ms — feels alive on mount
                  // without being so slow it draws attention.
                  transitionDelay: `${i * 100}ms`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
