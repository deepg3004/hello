"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Home, Trash2, ExternalLink, Pencil } from "lucide-react";

import {
  createSitePageAction,
  updateSitePageAction,
  deleteSitePageAction,
  setHomeSitePageAction,
} from "@/actions/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BlockEditor } from "@/components/dashboard/PageBuilder/BlockEditor";
import { presetsForCategory } from "@/lib/site-presets";
import { useToast } from "@/hooks/use-toast";

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
  const [editingId, setEditingId] = useState<string | null>(null);

  // Local editor state for the page being edited.
  const [title, setTitle] = useState("");
  const [navLabel, setNavLabel] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);

  function startEdit(p: SitePage) {
    setEditingId(p.id);
    setTitle(p.title);
    setNavLabel(p.nav_label ?? p.title);
    setBlocks(Array.isArray(p.blocks) ? (p.blocks as Block[]) : []);
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
    const r = await createSitePageAction({ title: "Home", blocks });
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't create", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Homepage created", description: "Edit the sections below." });
    router.refresh();
  }

  async function save(publish?: boolean) {
    if (!editingId) return;
    setBusy(true);
    const r = await updateSitePageAction({
      id: editingId,
      title,
      nav_label: navLabel,
      blocks,
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
          {initialPages.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3"
            >
              <div className="flex items-center gap-2">
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

          <BlockEditor blocks={blocks} onChange={setBlocks} />

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => save()} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save draft
            </Button>
            <Button onClick={() => save(true)} disabled={busy} variant="default">
              Save &amp; publish
            </Button>
            <Button onClick={() => save(false)} disabled={busy} variant="outline">
              Unpublish
            </Button>
            <Button onClick={() => setEditingId(null)} disabled={busy} variant="ghost">
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
