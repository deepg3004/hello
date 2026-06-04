"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { templatesForType } from "@/lib/templates/registry";
import { templateMatchesCreator } from "@/lib/templates/creator-map";
import { creatorCategoryLabel } from "@/lib/creator-categories";
import type { PageDbType } from "@/lib/templates/types";
import { cn } from "@/lib/utils";

interface TemplatePickerProps {
  type: PageDbType;
  value: string | null;
  onChange: (templateId: string) => void;
  /** Seller's creator category — matching templates are surfaced first. */
  creatorCategory?: string | null;
}

export function TemplatePicker({
  type,
  value,
  onChange,
  creatorCategory,
}: TemplatePickerProps) {
  const all = templatesForType(type);
  // Recommended (matching the seller's niche) first, preserving original order.
  const templates = [...all].sort((a, b) => {
    const am = templateMatchesCreator(a.definition.id, creatorCategory) ? 0 : 1;
    const bm = templateMatchesCreator(b.definition.id, creatorCategory) ? 0 : 1;
    return am - bm;
  });
  const nicheLabel = creatorCategoryLabel(creatorCategory);

  if (templates.length === 0) {
    return (
      <p className="rounded-md border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        No templates yet for this page type. Pick a different type.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => {
        const selected = value === t.definition.id;
        const recommended = templateMatchesCreator(t.definition.id, creatorCategory);
        return (
          <button
            key={t.definition.id}
            type="button"
            onClick={() => onChange(t.definition.id)}
            className="text-left focus:outline-none"
          >
            <Card
              className={cn(
                "h-full overflow-hidden transition",
                selected ? "border-primary shadow-md" : "hover:border-foreground/30",
              )}
            >
              <div
                className="flex h-32 items-center justify-center text-xs font-medium uppercase tracking-wider text-white/80"
                style={{ background: t.definition.theme.background }}
              >
                <span
                  className="rounded-md px-2 py-1"
                  style={{ background: t.definition.theme.primary, color: "#0a0a0a" }}
                >
                  {t.definition.theme.name}
                </span>
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{t.definition.name}</CardTitle>
                  {selected ? (
                    <Badge>Selected</Badge>
                  ) : recommended && nicheLabel ? (
                    <Badge variant="outline" className="shrink-0 text-emerald-600">
                      Recommended
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{t.definition.description}</CardDescription>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
