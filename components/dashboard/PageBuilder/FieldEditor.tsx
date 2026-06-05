"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/ui/image-upload";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { defaultPlaceholder } from "@/lib/templates/utils";
import { useSiteLinks } from "@/components/dashboard/website/SiteLinksContext";
import type { FieldConfig } from "@/lib/templates/types";
import { cn } from "@/lib/utils";

interface FieldEditorProps {
  field: FieldConfig;
  value: unknown;
  onChange: (next: unknown) => void;
  compact?: boolean;
}

export function FieldEditor({ field, value, onChange, compact }: FieldEditorProps) {
  const siteLinks = useSiteLinks();
  switch (field.type) {
    case "pagepicker": {
      const groups = Array.from(new Set(siteLinks.map((l) => l.group)));
      return (
        <Wrap field={field} compact={compact}>
          {siteLinks.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && onChange(e.target.value)}
              className="mb-2 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="">Pick one of your pages…</option>
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {siteLinks
                    .filter((l) => l.group === g)
                    .map((l) => (
                      <option key={l.url} value={l.url}>
                        {l.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          )}
          <Input
            value={(value as string) ?? ""}
            placeholder="or paste any URL"
            onChange={(e) => onChange(e.target.value)}
          />
        </Wrap>
      );
    }
    case "text":
      return (
        <Wrap field={field} compact={compact}>
          <Input
            value={(value as string) ?? ""}
            placeholder={defaultPlaceholder(field)}
            onChange={(e) => onChange(e.target.value)}
          />
        </Wrap>
      );
    case "textarea":
      return (
        <Wrap field={field} compact={compact}>
          <Textarea
            value={(value as string) ?? ""}
            placeholder={defaultPlaceholder(field)}
            rows={3}
            onChange={(e) => onChange(e.target.value)}
          />
        </Wrap>
      );
    case "image":
      return (
        <Wrap field={field} compact={compact}>
          <ImageUpload
            value={(value as string) ?? ""}
            onChange={(v) => onChange(v)}
            placeholder={defaultPlaceholder(field)}
            previewClassName="h-12 w-12 rounded-md object-cover"
          />
        </Wrap>
      );
    case "color":
      return (
        <Wrap field={field} compact={compact}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={(value as string) ?? "#000000"}
              onChange={(e) => onChange(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-input bg-background"
            />
            <Input
              value={(value as string) ?? ""}
              placeholder="#000000"
              onChange={(e) => onChange(e.target.value)}
              className="font-mono"
            />
          </div>
        </Wrap>
      );
    case "number":
      return (
        <Wrap field={field} compact={compact}>
          <Input
            type="number"
            value={(value as number) ?? 0}
            placeholder={defaultPlaceholder(field)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </Wrap>
      );
    case "select":
      return (
        <Wrap field={field} compact={compact}>
          <select
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {(field.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Wrap>
      );
    case "toggle":
      return (
        <div
          className={cn(
            "flex items-center justify-between",
            !compact && "rounded-md border bg-muted/30 px-3 py-2",
          )}
        >
          <div>
            <Label className="text-sm font-medium">{field.label}</Label>
            {field.hint && (
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            )}
          </div>
          <Switch
            checked={!!value}
            onCheckedChange={(b) => onChange(b)}
          />
        </div>
      );
    case "list":
      return (
        <ListEditor
          field={field}
          value={(value as Array<Record<string, unknown>>) ?? []}
          onChange={onChange}
        />
      );
    default:
      return null;
  }
}

function Wrap({
  field,
  compact,
  children,
}: {
  field: FieldConfig;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", compact && "space-y-1")}>
      <Label className="text-sm font-medium">{field.label}</Label>
      {children}
      {field.hint && (
        <p className="text-xs text-muted-foreground">{field.hint}</p>
      )}
    </div>
  );
}

function ListEditor({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: Array<Record<string, unknown>>;
  onChange: (next: Array<Record<string, unknown>>) => void;
}) {
  const items = Array.isArray(value) ? value : [];
  const min = field.minItems ?? 0;
  const max = field.maxItems ?? 50;

  function addItem() {
    if (items.length >= max) return;
    const blank: Record<string, unknown> = {};
    for (const f of field.itemFields ?? []) {
      blank[f.key] = f.defaultValue;
    }
    onChange([...items, blank]);
  }
  function removeItem(idx: number) {
    if (items.length <= min) return;
    onChange(items.filter((_, i) => i !== idx));
  }
  function updateItem(idx: number, key: string, v: unknown) {
    onChange(items.map((it, i) => (i === idx ? { ...it, [key]: v } : it)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{field.label}</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addItem}
          disabled={items.length >= max}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add {field.itemLabel ?? "item"}
        </Button>
      </div>
      {items.length === 0 && (
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
          No {field.itemLabel ?? "items"} yet. Click &quot;Add&quot; to start.
        </p>
      )}
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="space-y-2 rounded-md border bg-muted/20 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {field.itemLabel ?? "Item"} {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                disabled={items.length <= min}
                className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {(field.itemFields ?? []).map((sub) => (
              <FieldEditor
                key={sub.key}
                field={sub}
                value={item[sub.key]}
                onChange={(v) => updateItem(idx, sub.key, v)}
                compact
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
