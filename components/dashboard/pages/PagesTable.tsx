"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  MoreVertical,
  Pause,
  Pencil,
  Percent,
  Play,
  Trash2,
  Users,
} from "lucide-react";

import {
  deletePageAction,
  duplicatePageAction,
  togglePagePublishAction,
} from "@/actions/pages";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { DashboardPageRow } from "@/lib/dashboard/page-category-queries";
import { usePublicPageUrl } from "@/components/dashboard/SellerContext";
import { cn, formatINR } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  paused: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300",
  draft: "bg-muted text-muted-foreground ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300",
  archived: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300",
};

export function PagesTable({ rows }: { rows: DashboardPageRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Payment Page</TableHead>
            <TableHead>Price</TableHead>
            <TableHead className="text-right">Sale</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead>Payments</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Row({ row }: { row: DashboardPageRow }) {
  const router = useRouter();
  const { toast } = useToast();
  const buildPageUrl = usePublicPageUrl();
  const publicUrl = buildPageUrl(row.type, row.slug, row.template_id);
  const [busy, setBusy] = useState<"toggle" | "duplicate" | "delete" | null>(
    null,
  );
  const enabled = row.status === "published";

  async function toggle() {
    setBusy("toggle");
    const r = await togglePagePublishAction(row.id);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't update", description: r.message, variant: "destructive" });
    } else {
      router.refresh();
    }
  }

  async function duplicate() {
    setBusy("duplicate");
    const r = await duplicatePageAction(row.id);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't duplicate", description: r.message, variant: "destructive" });
      return;
    }
    if (r.pageId) router.push(`/dashboard/pages/${r.pageId}/edit`);
  }

  async function remove() {
    if (!confirm(`Delete "${row.title}"? This cannot be undone.`)) return;
    setBusy("delete");
    const r = await deletePageAction(row.id);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Delete failed", description: r.message, variant: "destructive" });
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
      toast({ title: "Copy failed", description: url, variant: "destructive" });
    }
  }

  return (
    <TableRow>
      {/* Page: thumbnail + name */}
      <TableCell>
        <Link
          href={`/dashboard/pages/${row.id}/edit`}
          className="flex items-center gap-3 group/row"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {row.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.thumbnail_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block max-w-[260px] truncate font-medium text-foreground group-hover/row:text-primary">
              {row.title}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              /p/{row.slug}
            </span>
          </span>
        </Link>
      </TableCell>

      {/* Price */}
      <TableCell className="whitespace-nowrap tabular-nums">
        {row.priceLabel}
      </TableCell>

      {/* Sales */}
      <TableCell className="text-right">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          {row.conversion_count.toLocaleString("en-IN")}
        </span>
      </TableCell>

      {/* Revenue */}
      <TableCell className="text-right font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
        {formatINR(row.total_revenue * 100)}
      </TableCell>

      {/* Payments status */}
      <TableCell>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
            STATUS_STYLE[row.status] ?? STATUS_STYLE.draft,
          )}
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </TableCell>

      {/* Actions */}
      <TableCell>
        <div className="flex items-center justify-end gap-0.5">
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            title="Open public page"
            aria-label="Open public page"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Globe className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={copyLink}
            title="Copy link"
            aria-label="Copy link"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Copy className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions" className="h-8 w-8">
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreVertical className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/pages/${row.id}/edit`}>
                  <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-3.5 w-3.5" /> Preview
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={duplicate} disabled={busy === "duplicate"}>
                <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={toggle} disabled={busy === "toggle"}>
                {enabled ? (
                  <>
                    <Pause className="mr-2 h-3.5 w-3.5" /> Unpublish
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-3.5 w-3.5" /> Publish
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/pages/${row.id}/ab-test`}>
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
      </TableCell>
    </TableRow>
  );
}
