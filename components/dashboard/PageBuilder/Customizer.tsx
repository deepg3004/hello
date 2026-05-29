"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";

import { FieldEditor } from "./FieldEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTemplate } from "@/lib/templates/registry";
import { encodeValues, isValidSlug, slugify } from "@/lib/templates/utils";

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

  const fields = useMemo(() => template?.definition.sections ?? [], [template]);

  if (!template) {
    return (
      <p className="rounded-md border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        Template not found.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
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
                    ? "text-xs text-emerald-600"
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
          </CardContent>
        </Card>

        {fields.map((section) => (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle className="text-base">{section.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {section.fields.map((f) => (
                <FieldEditor
                  key={f.key}
                  field={f}
                  value={values[f.key]}
                  onChange={(v) =>
                    onValuesChange({ ...values, [f.key]: v })
                  }
                />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* RIGHT — live preview */}
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
    </div>
  );
}
