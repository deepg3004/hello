"use client";

import { Check } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TG_THEMES, TG_ANIMATIONS } from "@/lib/telegram-themes";
import {
  SKIN_FONTS,
  SKIN_CORNERS,
  SKIN_SCALES,
} from "@/components/templates/PageSkin";
import { cn } from "@/lib/utils";

/**
 * Visual "Design" tab for the page editor. Edits the page_config keys the
 * public templates + the global PageSkin read (`theme`, `bg_animation`,
 * `page_font`, `accent_color`, `corner_style`, `page_scale`) so every change is
 * instant in the live preview.
 */
export function DesignTab({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const get = (k: string, fallback = "") =>
    typeof values[k] === "string" ? (values[k] as string) : fallback;
  const theme = get("theme", "purple");
  const bgAnimation = get("bg_animation", "none");
  const pageFont = get("page_font", "default");
  const accent = get("accent_color", "#F5C000");
  const cornerStyle = get("corner_style", "default");
  const pageScale = get("page_scale", "default");

  return (
    <div className="space-y-6">
      {/* ── Colour theme ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Colour theme</CardTitle>
          <CardDescription>
            Background gradient + accent colour for the whole page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(TG_THEMES).map(([key, t]) => {
              const active = theme === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange({ theme: key })}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border-2 p-2.5 text-left transition",
                    active
                      ? "border-primary ring-2 ring-primary/25"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <div
                    className="h-16 w-full rounded-lg"
                    style={{ background: t.bg }}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: t.accent }}
                    />
                    <span className="truncate text-sm font-medium text-foreground">
                      {t.label}
                    </span>
                  </div>
                  {active && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Font ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Font</CardTitle>
          <CardDescription>The typeface used across the page.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(SKIN_FONTS).map(([key, f]) => {
              const active = pageFont === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange({ page_font: key })}
                  style={f.stack ? { fontFamily: f.stack } : undefined}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left text-sm transition",
                    active
                      ? "border-primary bg-primary/10 font-medium text-foreground ring-1 ring-primary/25"
                      : "border-border text-foreground hover:border-primary/40",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Accent colour ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accent colour</CardTitle>
          <CardDescription>
            Used by light templates (checkout pills, buttons) and the page
            highlight. Dark themes above set their own accent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {ACCENT_SWATCHES.map((c) => {
              const active = accent.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => onChange({ accent_color: c })}
                  className={cn(
                    "h-8 w-8 rounded-full ring-1 ring-inset ring-black/10 transition",
                    active && "ring-2 ring-primary ring-offset-2",
                  )}
                  style={{ backgroundColor: c }}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#F5C000"}
              onChange={(e) => onChange({ accent_color: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
              aria-label="Custom accent colour"
            />
            <Input
              value={accent}
              onChange={(e) => onChange({ accent_color: e.target.value })}
              placeholder="#F5C000"
              className="max-w-[140px] font-mono uppercase"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Corner style + Scale (two-up) ─────────────────────────────── */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Corner style</CardTitle>
            <CardDescription>Button &amp; input roundness.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SKIN_CORNERS).map(([key, c]) => {
                const active = cornerStyle === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChange({ corner_style: key })}
                    className={cn(
                      "border px-3.5 py-1.5 text-sm transition",
                      key === "pill" && "rounded-full",
                      key === "rounded" && "rounded-lg",
                      key === "sharp" && "rounded-none",
                      key === "default" && "rounded-md",
                      active
                        ? "border-primary bg-primary/10 font-medium text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Text &amp; spacing</CardTitle>
            <CardDescription>Overall density of the page.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SKIN_SCALES).map(([key, s]) => {
                const active = pageScale === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChange({ page_scale: key })}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm transition",
                      active
                        ? "border-primary bg-primary/10 font-medium text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Background animation ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Background animation</CardTitle>
          <CardDescription>
            Optional ambient motion behind the page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TG_ANIMATIONS.map((a) => {
              const active = bgAnimation === a.key;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => onChange({ bg_animation: a.key })}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm transition",
                    active
                      ? "border-primary bg-primary/10 font-medium text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const ACCENT_SWATCHES = [
  "#F5C000", // golden
  "#6366F1", // indigo
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#F97316", // orange
  "#10B981", // emerald
  "#06B6D4", // cyan
  "#EF4444", // red
  "#0EA5E9", // sky
  "#111827", // near-black
];
