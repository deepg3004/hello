"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  ExternalLink,
  Eye,
  IndianRupee,
  Loader2,
  MoreVertical,
  Pause,
  Pencil,
  Percent,
  Play,
  Trash2,
} from "lucide-react";

import {
  deletePageAction,
  duplicatePageAction,
  togglePagePublishAction,
} from "@/actions/pages";
import { Button } from "@/components/ui/button";
import { usePublicPageUrl } from "@/components/dashboard/SellerContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDate, formatINR, truncate } from "@/lib/utils";

export interface PageCardData {
  id: string;
  title: string;
  slug: string;
  type: "payment" | "landing" | "lead_magnet";
  status: "draft" | "published" | "paused" | "archived";
  template_id: string;
  thumbnail_url: string | null;
  view_count: number;
  conversion_count: number;
  total_revenue: number;
  created_at: string;
}

// Top "band" colour + chip styling per page type. Telegram VIP is recognised
// from the template_id; the actual DB column is just 'payment'.
const TYPE_BAND: Record<string, { band: string; chip: string; label: string }> = {
  payment: {
    band: "bg-gradient-to-r from-indigo-500 to-indigo-600",
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30",
    label: "Payment",
  },
  landing: {
    band: "bg-gradient-to-r from-emerald-500 to-emerald-600",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
    label: "Landing",
  },
  lead_magnet: {
    band: "bg-gradient-to-r from-amber-500 to-amber-600",
    chip: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
    label: "Lead magnet",
  },
  telegram: {
    band: "bg-gradient-to-r from-violet-500 to-violet-600",
    chip: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30",
    label: "Telegram VIP",
  },
};

function bandKey(page: PageCardData): keyof typeof TYPE_BAND {
  // Telegram VIP is a payment page with a specific template — split it out
  // visually so sellers can tell their cards apart at a glance.
  if (page.template_id === "telegram-vip" || page.template_id === "telegram_vip") {
    return "telegram";
  }
  return page.type;
}

export function PageCard({ page }: { page: PageCardData }) {
  const router = useRouter();
  const { toast } = useToast();
  const buildPageUrl = usePublicPageUrl();
  const publicUrl = buildPageUrl(page.type, page.slug, page.template_id);
  const [busy, setBusy] = useState<"toggle" | "duplicate" | "delete" | null>(
    null,
  );

  const variant = TYPE_BAND[bandKey(page)] ?? TYPE_BAND.payment!;
  const isPublished = page.status === "published";
  const conversionRate =
    page.view_count > 0
      ? `${((page.conversion_count / page.view_count) * 100).toFixed(1)}%`
      : "—";

  async function toggle() {
    setBusy("toggle");
    const r = await togglePagePublishAction(page.id);
    setBusy(null);
    if (!r.ok) {
      toast({
        title: "Couldn't update",
        description: r.message,
        variant: "destructive",
      });
    } else {
      router.refresh();
    }
  }

  async function duplicate() {
    setBusy("duplicate");
    const r = await duplicatePageAction(page.id);
    setBusy(null);
    if (!r.ok) {
      toast({
        title: "Couldn't duplicate",
        description: r.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Duplicated", description: "Opening the copy…" });
    if (r.pageId) router.push(`/dashboard/pages/${r.pageId}/edit`);
  }

  async function remove() {
    if (!confirm(`Delete "${page.title}"? This cannot be undone.`)) return;
    setBusy("delete");
    const r = await deletePageAction(page.id);
    setBusy(null);
    if (!r.ok) {
      toast({
        title: "Delete failed",
        description: r.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Page deleted" });
    router.refresh();
  }

  async function copyLink() {
    const url = publicUrl;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: url });
    } catch {
      toast({
        title: "Copy failed",
        description: url,
        variant: "destructive",
      });
    }
  }

  return (
    <div
      className={cn(
        "card-surface card-surface-hover group flex flex-col overflow-hidden",
      )}
    >
      {/* Coloured 10px band — instant visual tag for the page type */}
      <div
        aria-hidden
        className={cn("h-[10px] w-full", variant.band)}
      />

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* Title + status toggle pill */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href={`/dashboard/pages/${page.id}/edit`}
              className="block min-w-0"
            >
              <h3
                className="truncate font-sora text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary"
                title={page.title}
              >
                {page.title}
              </h3>
            </Link>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              /p/{truncate(page.slug, 30)}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="More actions"
                className="-mr-2 shrink-0"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreVertical className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={duplicate} disabled={busy === "duplicate"}>
                <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={toggle} disabled={busy === "toggle"}>
                {isPublished ? (
                  <>
                    <Pause className="mr-2 h-3.5 w-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-3.5 w-3.5" /> Publish
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/pages/${page.id}/ab-test`}>
                  <Percent className="mr-2 h-3.5 w-3.5" /> A/B test
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={remove}
                disabled={busy === "delete"}
                className="text-rose-600 focus:text-rose-700 dark:text-rose-300 dark:focus:text-rose-200"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Type chip + status pill (clickable to toggle) */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
              variant.chip,
            )}
          >
            {variant.label}
          </span>
          <button
            type="button"
            onClick={toggle}
            disabled={busy === "toggle"}
            title={
              isPublished ? "Click to pause" : "Click to publish"
            }
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition",
              "disabled:opacity-70",
              isPublished
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                : page.status === "paused"
                  ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
                  : "border border-border bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isPublished
                  ? "bg-emerald-500"
                  : page.status === "paused"
                    ? "bg-amber-500"
                    : "bg-muted-foreground/50",
              )}
            />
            {page.status}
          </button>
        </div>

        {/* Stats row — views, CR, revenue */}
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/30 p-3 text-center">
          <Stat
            icon={Eye}
            value={page.view_count.toLocaleString("en-IN")}
            label="Views"
          />
          <Stat
            icon={Percent}
            value={conversionRate}
            label="Conv. rate"
          />
          <Stat
            icon={IndianRupee}
            value={formatINR(page.total_revenue * 100)}
            label="Revenue"
            valueClassName="text-emerald-700 dark:text-emerald-300"
          />
        </div>

        {/* Footer: created date + action icons */}
        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">
            Created {formatDate(page.created_at)}
          </span>
          <div className="flex items-center gap-0.5">
            <IconButton
              href={`/dashboard/pages/${page.id}/edit`}
              icon={Pencil}
              label="Edit"
            />
            <IconButton
              href={publicUrl}
              external
              icon={ExternalLink}
              label="Preview"
            />
            <button
              type="button"
              onClick={copyLink}
              title="Copy link"
              aria-label="Copy link"
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function Stat({
  icon: Icon,
  value,
  label,
  valueClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span
          className={cn(
            "font-sora text-sm font-semibold text-foreground",
            valueClassName,
          )}
        >
          {value}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function IconButton({
  href,
  external,
  icon: Icon,
  label,
}: {
  href: string;
  external?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  const className =
    "rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground";
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title={label}
        aria-label={label}
        className={className}
      >
        <Icon className="h-3.5 w-3.5" />
      </a>
    );
  }
  return (
    <Link href={href} title={label} aria-label={label} className={className}>
      <Icon className="h-3.5 w-3.5" />
    </Link>
  );
}

// Per-type copy + deep-link target for the "+ New page" tile. When a `type`
// is given the tile jumps straight into the wizard scoped to that category
// (skipping the generic type picker).
const NEW_TILE: Record<
  "payment" | "landing" | "lead_magnet",
  { label: string; hint: string }
> = {
  payment: { label: "New payment page", hint: "Sell a product or service" },
  landing: { label: "New landing page", hint: "Promote an offer or event" },
  lead_magnet: { label: "New lead page", hint: "Capture emails with a freebie" },
};

/**
 * Render this as a grid cell after all the real PageCards. Acts as a
 * "+ New page" tile. Pass `type` to scope creation to a single category.
 */
export function CreatePageTile({
  disabled,
  type,
  href: hrefOverride,
}: {
  disabled?: boolean;
  type?: "payment" | "landing" | "lead_magnet";
  /** Full create URL — used when the category needs a template deep-link too. */
  href?: string;
}) {
  const copy = type ? NEW_TILE[type] : null;
  const href = disabled
    ? "/dashboard/upgrade"
    : (hrefOverride ??
      (type ? `/dashboard/pages/new?type=${type}` : "/dashboard/pages/new"));
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-xl",
        "border-2 border-dashed border-border bg-card/60 p-6 text-center transition",
        "hover:border-primary hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10",
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:group-hover:bg-indigo-500/20">
        <PlusIcon />
      </span>
      <p className="font-sora text-sm font-semibold text-foreground">
        {disabled ? "Upgrade for more pages" : (copy?.label ?? "New page")}
      </p>
      <p className="text-xs text-muted-foreground">
        {disabled
          ? "You've hit your plan limit"
          : (copy?.hint ?? "Build a payment, landing, or lead-magnet page")}
      </p>
    </Link>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
