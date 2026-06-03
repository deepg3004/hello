"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";

import { FieldEditor } from "./FieldEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTemplate } from "@/lib/templates/registry";
import { groupSectionsByCategory } from "@/lib/templates/section-categories";
import { encodeValues, isValidSlug, slugify } from "@/lib/templates/utils";
import { BlockEditor } from "./BlockEditor";
import { cn } from "@/lib/utils";
import type {
  SectionCategory,
  TemplateSection,
} from "@/lib/templates/types";

interface CustomizerProps {
  templateId: string;
  title: string;
  onTitleChange: (next: string) => void;
  slug: string;
  onSlugChange: (next: string) => void;
  /** Locked slug means the user is editing an existing page; we don't auto-replace. */
  slugLocked?: boolean;
  values: Record<string, unknown>;
  onValuesChange: (next: Record<string, unknown>) => void;
  /** Page type — when "payment", the Page Settings card shows a Price field.
   *  Left undefined / "landing" / "lead_magnet" hides it. */
  pageType?: "payment" | "landing" | "lead_magnet";
  /** Current price (as the raw input string so empty is preserved). */
  price?: string;
  onPriceChange?: (next: string) => void;
  /** Hide the "Design" (theme/animation) section — the edit page surfaces it in
   *  a dedicated Design tab instead. The create wizard leaves it visible. */
  hideDesign?: boolean;
  /** Hide the built-in preview pane — the edit shell shows one persistent
   *  preview beside every step instead. */
  hidePreview?: boolean;
}

const PREVIEW_DEBOUNCE_MS = 500;

export function Customizer({
  templateId,
  title,
  onTitleChange,
  slug,
  onSlugChange,
  slugLocked,
  values,
  onValuesChange,
  pageType,
  price,
  onPriceChange,
  hideDesign,
  hidePreview,
}: CustomizerProps) {
  const template = getTemplate(templateId);

  // Slug uniqueness check
  const [slugCheck, setSlugCheck] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");

  useEffect(() => {
    if (!slug) {
      setSlugCheck("idle");
      return;
    }
    if (!isValidSlug(slug)) {
      setSlugCheck("invalid");
      return;
    }
    setSlugCheck("checking");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/pages/check-slug?slug=${encodeURIComponent(slug)}`,
        );
        const body = (await res.json()) as { available?: boolean };
        setSlugCheck(body.available ? "available" : "taken");
      } catch {
        setSlugCheck("idle");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  // Auto-slugify from title until user manually edits slug or slug is locked
  const slugManuallyEditedRef = useRef(slugLocked ?? false);
  useEffect(() => {
    if (slugManuallyEditedRef.current) return;
    if (!title) return;
    const next = slugify(title);
    if (next && next !== slug) onSlugChange(next);
    // we intentionally don't depend on slug here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  // Debounced preview URL
  const [previewUrl, setPreviewUrl] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      const encoded = encodeValues({ __title: title, ...values });
      setPreviewUrl(`/preview/${templateId}?v=${encoded}`);
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [templateId, values, title]);

  const fields = useMemo(
    () =>
      (template?.definition.sections ?? []).filter(
        (s) => !(hideDesign && s.id === "design"),
      ),
    [template, hideDesign],
  );
  // Bucket sections into Payment / Landing / Leads tabs (empty buckets dropped).
  const sectionGroups = useMemo(
    () => groupSectionsByCategory(fields),
    [fields],
  );
  const [activeCat, setActiveCat] = useState(
    () => sectionGroups[0]?.category ?? "landing",
  );
  // If the resolved groups no longer contain the active tab (template switch),
  // snap back to the first available one.
  useEffect(() => {
    if (!sectionGroups.some((g) => g.category === activeCat)) {
      setActiveCat(sectionGroups[0]?.category ?? "landing");
    }
  }, [sectionGroups, activeCat]);

  // Each section is a collapsible dropdown so long forms stay scannable.
  const renderSection = (section: TemplateSection) => (
    <AccordionItem
      key={section.id}
      value={section.id}
      className="overflow-hidden rounded-lg border bg-card"
    >
      <AccordionTrigger className="px-4 text-sm font-semibold hover:no-underline">
        {section.label}
      </AccordionTrigger>
      <AccordionContent className="space-y-4 px-4 pb-4">
        {section.fields.map((f) => (
          <FieldEditor
            key={f.key}
            field={f}
            value={values[f.key]}
            onChange={(v) => onValuesChange({ ...values, [f.key]: v })}
          />
        ))}
      </AccordionContent>
    </AccordionItem>
  );

  if (!template) {
    return (
      <p className="rounded-md border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        Template not found.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-6",
        !hidePreview && "lg:grid-cols-[420px_1fr]",
      )}
    >
      {/* LEFT — field editor */}
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Page settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Page title</Label>
              <Input
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Internal name + browser tab"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">/p/</span>
                <Input
                  value={slug}
                  onChange={(e) => {
                    slugManuallyEditedRef.current = true;
                    onSlugChange(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]+/g, "-")
                        .slice(0, 64),
                    );
                  }}
                  placeholder="my-course"
                  disabled={slugLocked}
                />
              </div>
              <p
                className={
                  slugCheck === "available"
                    ? "text-xs text-emerald-600 dark:text-emerald-300"
                    : slugCheck === "taken" || slugCheck === "invalid"
                      ? "text-xs text-destructive"
                      : "text-xs text-muted-foreground"
                }
              >
                {slugCheck === "checking"
                  ? "Checking…"
                  : slugCheck === "available"
                    ? "Slug is available."
                    : slugCheck === "taken"
                      ? "Slug already used. Pick another."
                      : slugCheck === "invalid"
                        ? "Use lowercase letters, numbers and dashes."
                        : "Slug appears in the page URL."}
              </p>
            </div>

            {/* Price — only for payment pages. Auto-creates / updates the
                attached products row so checkout has something to charge for. */}
            {pageType === "payment" && onPriceChange && (
              <div className="space-y-1.5">
                <Label>Price (INR)</Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="1"
                    step="0.01"
                    value={price ?? ""}
                    onChange={(e) => onPriceChange(e.target.value)}
                    placeholder="499"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Charged to the buyer when they click the checkout button.
                  Leave blank to skip product creation (checkout disabled).
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* "Build from scratch" → block editor; otherwise the template's fixed
            sections (grouped into Payment / Landing / Leads tabs). */}
        {templateId === "custom" ? (
          <BlockEditor
            blocks={values.blocks}
            onChange={(b) => onValuesChange({ ...values, blocks: b })}
          />
        ) : sectionGroups.length > 1 ? (
          <Tabs
            value={activeCat}
            onValueChange={(v) => setActiveCat(v as SectionCategory)}
          >
            <TabsList className="grid w-full grid-cols-3">
              {sectionGroups.map((g) => (
                <TabsTrigger key={g.category} value={g.category}>
                  {g.label}
                  <span className="ml-1.5 rounded-full bg-muted-foreground/15 px-1.5 text-[11px] font-medium tabular-nums">
                    {g.sections.length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            {sectionGroups.map((g) => (
              <TabsContent
                key={g.category}
                value={g.category}
                className="mt-5"
              >
                <Accordion type="multiple" className="space-y-3">
                  {g.sections.map(renderSection)}
                </Accordion>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <Accordion type="multiple" className="space-y-3">
            {fields.map(renderSection)}
          </Accordion>
        )}
      </div>

      {/* RIGHT — live preview (hidden when the shell owns one) */}
      {!hidePreview && (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Live preview</Label>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Open in new tab <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="overflow-hidden rounded-lg border bg-muted/30">
          {previewUrl ? (
            <iframe
              key={templateId}
              src={previewUrl}
              className="h-[800px] w-full bg-white"
              title="Live preview"
            />
          ) : (
            <div className="flex h-[800px] items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading preview
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
