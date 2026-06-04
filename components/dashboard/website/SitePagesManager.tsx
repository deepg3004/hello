"use client";

import { useState } from "react";
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
  Monitor,
  Smartphone,
} from "lucide-react";

import {
  createSitePageAction,
  updateSitePageAction,
  deleteSitePageAction,
  setHomeSitePageAction,
  reorderSitePagesAction,
} from "@/actions/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BlockEditor } from "@/components/dashboard/PageBuilder/BlockEditor";
import { SitePreview } from "@/components/dashboard/website/SitePreview";
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

interface Block {
  id: string;
  type: string;
  data: Record<string, unknown>;
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
  preview,
}: {
  initialPages: SitePage[];
  storeUrl: string | null;
  creatorCategory?: string | null;
  preview: PreviewMeta;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  // Local editor state for the page being edited.
  const [title, setTitle] = useState("");
  const [navLabel, setNavLabel] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");

  function startEdit(p: SitePage) {
    setEditingId(p.id);
    setTitle(p.title);
    setNavLabel(p.nav_label ?? p.title);
    setBlocks(Array.isArray(p.blocks) ? (p.blocks as Block[]) : []);
    setSeoTitle(p.seo_title ?? "");
    setSeoDesc(p.seo_description ?? "");
  }

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

  const presets = presetsForCategory(creatorCategory);

  async function addPage() {
    setBusy(true);
    const r = await createSitePageAction({ title: "New page" });
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't create", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Page created" });
    router.refresh();
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
    toast({ title: "Homepage published 🎉", description: "It's live on your site now." });
    router.refresh();
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

  // Is the live site actually showing the builder? Only when the home page is
  // published. Otherwise the subdomain falls back to the product store.
  const homePage = initialPages.find((p) => p.is_home);
  const homeLive = homePage?.status === "published";

  async function save(publish?: boolean) {
    if (!editingId) return;
    setBusy(true);
    const r = await updateSitePageAction({
      id: editingId,
      title,
      nav_label: navLabel,
      blocks,
      seo_title: seoTitle || null,
      seo_description: seoDesc || null,
      ...(publish !== undefined ? { status: publish ? "published" : "draft" } : {}),
    });
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't save", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: publish === true ? "Published" : publish === false ? "Unpublished" : "Saved" });
    setEditingId(null);
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
    if (editingId === p.id) setEditingId(null);
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
                <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
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

      {/* Inline editor for the selected page */}
      {editingId && (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Page title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nav label</Label>
              <Input value={navLabel} onChange={(e) => setNavLabel(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Left: the editor controls */}
            <div className="space-y-4">
              <BlockEditor blocks={blocks} onChange={setBlocks} />

              <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">SEO title</Label>
                  <Input
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    placeholder="Shown in search results & browser tab"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">SEO description</Label>
                  <Input
                    value={seoDesc}
                    onChange={(e) => setSeoDesc(e.target.value)}
                    placeholder="One-line summary for search engines"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => save(true)} disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save &amp; publish
                </Button>
                <Button onClick={() => save()} disabled={busy} variant="outline">
                  Save draft
                </Button>
                <Button onClick={() => save(false)} disabled={busy} variant="ghost">
                  Unpublish
                </Button>
                <Button onClick={() => setEditingId(null)} disabled={busy} variant="ghost">
                  Close
                </Button>
              </div>
            </div>

            {/* Right: live preview */}
            <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Live preview
                </span>
                <div className="flex gap-1">
                  <Button
                    variant={device === "desktop" ? "default" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setDevice("desktop")}
                    aria-label="Desktop preview"
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={device === "mobile" ? "default" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setDevice("mobile")}
                    aria-label="Mobile preview"
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border bg-muted/20">
                <div className="h-[620px] overflow-y-auto">
                  <div
                    className="mx-auto bg-white"
                    style={{ width: device === "mobile" ? 390 : "100%" }}
                  >
                    <SitePreview
                      blocks={blocks}
                      theme={preview.theme}
                      font={preview.font}
                      brandColor={preview.brandColor}
                      seller={preview.seller}
                      socialLinks={preview.socialLinks}
                      products={preview.products}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Updates as you edit. Click <strong>Save &amp; publish</strong> to make it live.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
