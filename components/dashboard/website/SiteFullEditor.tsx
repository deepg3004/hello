"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Monitor, Smartphone, ExternalLink } from "lucide-react";

import { updateSitePageAction } from "@/actions/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockEditor } from "@/components/dashboard/PageBuilder/BlockEditor";
import { SitePreview } from "@/components/dashboard/website/SitePreview";
import {
  SiteLinksProvider,
  type SiteLink,
} from "@/components/dashboard/website/SiteLinksContext";
import type { PreviewMeta } from "@/components/dashboard/website/SitePagesManager";
import { useToast } from "@/hooks/use-toast";

interface Block {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface EditorPage {
  id: string;
  slug: string;
  title: string;
  nav_label: string | null;
  status: "draft" | "published";
  blocks: unknown;
  seo_title: string | null;
  seo_description: string | null;
}

/** Full-screen website page editor: controls on the left, live preview right. */
export function SiteFullEditor({
  page,
  preview,
  publicUrl,
  links,
}: {
  page: EditorPage;
  preview: PreviewMeta;
  publicUrl: string | null;
  links: SiteLink[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState(page.title);
  const [navLabel, setNavLabel] = useState(page.nav_label ?? page.title);
  const [blocks, setBlocks] = useState<Block[]>(
    Array.isArray(page.blocks) ? (page.blocks as Block[]) : [],
  );
  const [seoTitle, setSeoTitle] = useState(page.seo_title ?? "");
  const [seoDesc, setSeoDesc] = useState(page.seo_description ?? "");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(page.status);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function editBlock(id: string, data: Record<string, unknown>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, data } : b)));
  }

  async function save(publish?: boolean) {
    setBusy(true);
    const r = await updateSitePageAction({
      id: page.id,
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
    if (publish === true) setStatus("published");
    if (publish === false) setStatus("draft");
    toast({
      title: publish === true ? "Published — live now" : publish === false ? "Unpublished" : "Saved",
    });
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b bg-card px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/website")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <span className="truncate text-sm font-medium">{title || "Untitled"}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              status === "published"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {status === "published" ? "Published" : "Draft"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {publicUrl && status === "published" && (
            <Button asChild variant="ghost" size="sm">
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> View
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => save()} disabled={busy}>
            Save draft
          </Button>
          <Button size="sm" onClick={() => save(true)} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save &amp; publish
          </Button>
        </div>
      </div>

      {/* Split body */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Controls */}
        <div className="w-full overflow-y-auto border-b p-4 lg:w-[420px] lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Page title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Nav label</Label>
                <Input value={navLabel} onChange={(e) => setNavLabel(e.target.value)} />
              </div>
            </div>

            <SiteLinksProvider links={links}>
              <BlockEditor
                blocks={blocks}
                onChange={setBlocks}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </SiteLinksProvider>

            <div className="grid gap-4 border-t pt-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">SEO title</Label>
                <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">SEO description</Label>
                <Input value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground">Live preview</span>
            <div className="flex gap-1">
              <Button
                variant={device === "desktop" ? "default" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setDevice("desktop")}
                aria-label="Desktop"
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={device === "mobile" ? "default" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => setDevice("mobile")}
                aria-label="Mobile"
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div
              className="mx-auto overflow-hidden rounded-xl border bg-white shadow-sm"
              style={{ width: device === "mobile" ? 390 : "100%", maxWidth: "100%" }}
            >
              <SitePreview
                blocks={blocks}
                theme={preview.theme}
                font={preview.font}
                brandColor={preview.brandColor}
                seller={preview.seller}
                socialLinks={preview.socialLinks}
                products={preview.products}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onEditBlock={editBlock}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
