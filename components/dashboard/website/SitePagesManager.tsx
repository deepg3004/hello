"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Home,
  Trash2,
  ExternalLink,
  Pencil,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
} from "lucide-react";

import {
  createSitePageAction,
  updateSitePageAction,
  deleteSitePageAction,
  setHomeSitePageAction,
  reorderSitePagesAction,
} from "@/actions/site";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { presetsForCategory } from "@/lib/site-presets";
import type { SiteProductLite } from "@/components/templates/blocks/registry";
import { useToast } from "@/hooks/use-toast";

export interface PreviewMeta {
  theme: string | null;
  font: string | null;
  brandColor: string | null;
  seller: { name: string; avatar: string | null };
  socialLinks: Record<string, string> | null;
  products: SiteProductLite[];
}

export interface SitePage {
  id: string;
  slug: string;
  title: string;
  nav_label: string | null;
  is_home: boolean;
  show_in_nav: boolean;
  status: "draft" | "published";
  blocks: unknown;
  seo_title: string | null;
  seo_description: string | null;
}

export function SitePagesManager({
  initialPages,
  storeUrl,
  creatorCategory,
}: {
  initialPages: SitePage[];
  storeUrl: string | null;
  creatorCategory?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const presets = presetsForCategory(creatorCategory);
  const homePage = initialPages.find((p) => p.is_home);
  const homeLive = homePage?.status === "published";

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= initialPages.length) return;
    const ids = initialPages.map((p) => p.id);
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    setBusy(true);
    await reorderSitePagesAction(ids);
    setBusy(false);
    router.refresh();
  }

  async function toggleNav(p: SitePage) {
    setBusy(true);
    await updateSitePageAction({ id: p.id, show_in_nav: !p.show_in_nav });
    setBusy(false);
    router.refresh();
  }

  async function addPage() {
    setBusy(true);
    const r = await createSitePageAction({ title: "New page" });
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't create", description: r.message, variant: "destructive" });
      return;
    }
    // Open the new page straight into the full-screen editor.
    if (r.pageId) router.push(`/dashboard/website/${r.pageId}/edit`);
    else router.refresh();
  }

  async function addFromPreset(blocks: unknown) {
    setBusy(true);
    // Publish immediately so the seller's site goes live right away; they can
    // keep editing afterwards.
    const r = await createSitePageAction({ title: "Home", blocks, publish: true });
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't create", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Homepage published 🎉", description: "Opening the editor…" });
    if (r.pageId) router.push(`/dashboard/website/${r.pageId}/edit`);
    else router.refresh();
  }

  async function togglePublish(p: SitePage) {
    setBusy(true);
    const r = await updateSitePageAction({
      id: p.id,
      status: p.status === "published" ? "draft" : "published",
    });
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't update", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: p.status === "published" ? "Unpublished" : "Published — now live" });
    router.refresh();
  }

  async function setHome(id: string) {
    setBusy(true);
    const r = await setHomeSitePageAction(id);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't set home", description: r.message, variant: "destructive" });
      return;
    }
    router.refresh();
  }

  async function remove(p: SitePage) {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    setBusy(true);
    const r = await deleteSitePageAction(p.id);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't delete", description: r.message, variant: "destructive" });
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-sora text-base font-semibold">Pages</h2>
          <p className="text-sm text-muted-foreground">
            Build your site from sections. The Home page shows at your store root.
          </p>
        </div>
        <Button onClick={addPage} disabled={busy} size="sm">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Add page
        </Button>
      </div>

      {initialPages.length > 0 && !homeLive && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-500/40 dark:bg-yellow-500/10 dark:text-yellow-200">
          <span>
            <strong>Your website isn&apos;t live yet.</strong>{" "}
            {homePage
              ? "Your home page is a draft — visitors still see your product store until you publish it."
              : "Set one page as Home, then publish it to go live."}
          </span>
          {homePage && (
            <Button size="sm" onClick={() => togglePublish(homePage)} disabled={busy}>
              Publish home page
            </Button>
          )}
        </div>
      )}

      {initialPages.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-5">
          <p className="text-sm font-medium">Start from a template</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            One click to create a ready-made homepage you can then edit.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => addFromPreset(p.blocks)}
                disabled={busy}
                className="rounded-lg border bg-card p-4 text-left transition hover:border-primary disabled:opacity-50"
              >
                <span className="font-medium">{p.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {p.description}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 text-center text-xs text-muted-foreground">
            or{" "}
            <button
              type="button"
              onClick={addPage}
              disabled={busy}
              className="underline hover:text-foreground"
            >
              start with a blank page
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {initialPages.map((p, i) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <div className="mr-1 flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={busy || i === 0}
                    aria-label="Move up"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={busy || i === initialPages.length - 1}
                    aria-label="Move down"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
                <span className="font-medium">{p.title}</span>
                {p.is_home && (
                  <Badge variant="outline" className="gap-1">
                    <Home className="h-3 w-3" /> Home
                  </Badge>
                )}
                <Badge variant={p.status === "published" ? "default" : "outline"}>
                  {p.status === "published" ? "Published" : "Draft"}
                </Badge>
                <span className="text-xs text-muted-foreground">/{p.slug}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button asChild size="sm">
                  <Link href={`/dashboard/website/${p.id}/edit`}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Link>
                </Button>
                <Button
                  variant={p.status === "published" ? "ghost" : "default"}
                  size="sm"
                  onClick={() => togglePublish(p)}
                  disabled={busy}
                >
                  {p.status === "published" ? "Unpublish" : "Publish"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleNav(p)}
                  disabled={busy}
                  title={p.show_in_nav ? "Shown in nav" : "Hidden from nav"}
                >
                  {p.show_in_nav ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
                {!p.is_home && (
                  <Button variant="ghost" size="sm" onClick={() => setHome(p.id)} disabled={busy}>
                    <Home className="mr-1 h-3.5 w-3.5" /> Set home
                  </Button>
                )}
                {storeUrl && p.status === "published" && (
                  <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                    <a
                      href={p.is_home ? storeUrl : `${storeUrl}/${p.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="View"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(p)}
                  disabled={busy}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
