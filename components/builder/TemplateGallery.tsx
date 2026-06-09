"use client";

// Template gallery: filter by PAGE TYPE then CATEGORY, preview cards, and
// "Apply in 1 click" → copies the template into a new builder page and opens it.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BUILDER_TEMPLATES, TEMPLATE_PAGE_TYPES, type BuilderTemplate } from "@/lib/builder/templates";

export function TemplateGallery() {
  const router = useRouter();
  const { toast } = useToast();
  const [pageType, setPageType] = useState<BuilderTemplate["page_type"]>("payment");
  const [category, setCategory] = useState<string>("all");
  const [applying, setApplying] = useState<string | null>(null);

  const byType = useMemo(() => BUILDER_TEMPLATES.filter((t) => t.page_type === pageType), [pageType]);
  const categories = useMemo(() => ["all", ...new Set(byType.map((t) => t.category))], [byType]);
  const shown = useMemo(
    () => byType.filter((t) => category === "all" || t.category === category),
    [byType, category],
  );

  async function apply(t: BuilderTemplate) {
    setApplying(t.id);
    try {
      const res = await fetch("/api/builder/sites/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId: t.id }),
      });
      const data = (await res.json()) as { ok?: boolean; pageId?: string; error?: string };
      if (!res.ok || !data.pageId) throw new Error(data.error ?? "Couldn't apply");
      toast({ title: "Template applied 🎉", description: "Opening the editor…" });
      router.push(`/dashboard/builder/editor?page=${data.pageId}`);
    } catch (e) {
      toast({ title: "Couldn't apply", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
      setApplying(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Page-type filter */}
      <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
        {TEMPLATE_PAGE_TYPES.map((pt) => (
          <button
            key={pt.key}
            type="button"
            onClick={() => {
              setPageType(pt.key);
              setCategory("all");
            }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              pageType === pt.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {pt.label}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
              category === cat ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((t) => (
          <div key={t.id} className="overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.preview_image_url} alt={t.name} className="aspect-[16/10] w-full object-cover" />
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{t.name}</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{t.category}</span>
              </div>
              <Button size="sm" className="mt-3 w-full" onClick={() => apply(t)} disabled={applying === t.id}>
                {applying === t.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                Apply in 1 click
              </Button>
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <p className="text-sm text-muted-foreground">No templates in this category yet.</p>
        )}
      </div>
    </div>
  );
}
