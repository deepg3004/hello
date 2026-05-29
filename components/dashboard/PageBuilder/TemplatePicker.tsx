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
import type { PageDbType } from "@/lib/templates/types";
import { cn } from "@/lib/utils";

interface TemplatePickerProps {
  type: PageDbType;
  value: string | null;
  onChange: (templateId: string) => void;
}

export function TemplatePicker({ type, value, onChange }: TemplatePickerProps) {
  const templates = templatesForType(type);

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
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t.definition.name}</CardTitle>
                  {selected && <Badge>Selected</Badge>}
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
