"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  ExternalLink,
  Loader2,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";

import {
  deletePageAction,
  duplicatePageAction,
  togglePagePublishAction,
} from "@/actions/pages";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/utils";
import { getTemplate } from "@/lib/templates/registry";

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

const TYPE_LABEL: Record<PageCardData["type"], string> = {
  payment: "Payment",
  landing: "Landing",
  lead_magnet: "Lead magnet",
};

export function PageCard({ page }: { page: PageCardData }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"toggle" | "duplicate" | "delete" | null>(null);

  const template = getTemplate(page.template_id);
  const themeBg = template?.definition.theme.background ?? "#0a0a0a";
  const themePrimary = template?.definition.theme.primary ?? "#ffffff";
  const conversionRate =
    page.view_count > 0
      ? `${((page.conversion_count / page.view_count) * 100).toFixed(1)}%`
      : "—";

  async function toggle() {
    setBusy("toggle");
    const r = await togglePagePublishAction(page.id);
    setBusy(null);
    if (!r.ok) toast({ title: "Couldn't update", description: r.message, variant: "destructive" });
    else router.refresh();
  }

  async function duplicate() {
    setBusy("duplicate");
    const r = await duplicatePageAction(page.id);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't duplicate", description: r.message, variant: "destructive" });
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
      toast({ title: "Delete failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Page deleted" });
    router.refresh();
  }

  async function copyLink() {
    const url = `${window.location.origin}/p/${page.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: url });
    } catch {
      toast({ title: "Copy failed", description: url, variant: "destructive" });
    }
  }

  return (
    <Card className="overflow-hidden">
      <div
        className="flex h-28 items-center justify-center"
        style={{ background: themeBg }}
      >
        {page.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.thumbnail_url} alt={page.title} className="h-full w-full object-cover" />
        ) : (
          <span
            className="rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider"
            style={{ background: themePrimary, color: "#0a0a0a" }}
          >
            {template?.definition.name ?? "Template"}
          </span>
        )}
      </div>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{page.title}</h3>
            <p className="truncate text-xs text-muted-foreground">/p/{page.slug}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/pages/${page.id}/edit`}>
                  <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/p/${page.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-3.5 w-3.5" /> View live
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={copyLink}>
                <Copy className="mr-2 h-3.5 w-3.5" /> Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={duplicate} disabled={busy === "duplicate"}>
                <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={toggle} disabled={busy === "toggle"}>
                {page.status === "published" ? (
                  <>
                    <Pause className="mr-2 h-3.5 w-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-3.5 w-3.5" /> Publish
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={remove}
                disabled={busy === "delete"}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{TYPE_LABEL[page.type]}</Badge>
          <StatusBadge status={page.status} />
        </div>
        <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs">
          <div>
            <div className="text-sm font-semibold">{page.view_count.toLocaleString("en-IN")}</div>
            <div className="text-muted-foreground">Views</div>
          </div>
          <div>
            <div className="text-sm font-semibold">{conversionRate}</div>
            <div className="text-muted-foreground">CR</div>
          </div>
          <div>
            <div className="text-sm font-semibold">{formatINR(page.total_revenue * 100)}</div>
            <div className="text-muted-foreground">Revenue</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
