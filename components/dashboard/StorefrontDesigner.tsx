"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { saveStorefrontDesignAction } from "@/actions/storefront";
import {
  STOREFRONT_THEME_LIST,
  FONTS,
  themeCssVars,
  type SurfaceConfig,
  type Surface,
  type FontKey,
  type HeroStyle,
  type CardStyle,
  type RadiusKey,
  type DensityKey,
} from "@/lib/storefront-theme";

const HEROES: HeroStyle[] = ["banner", "gradient", "minimal", "split"];
const CARDS: CardStyle[] = ["elevated", "bordered", "glass", "flat"];
const RADII: RadiusKey[] = ["sharp", "soft", "round"];
const DENSITIES: DensityKey[] = ["comfortable", "compact"];

export function StorefrontDesigner({
  store,
  course,
  storeUrl,
}: {
  store: SurfaceConfig;
  course: SurfaceConfig;
  storeUrl: string | null;
}) {
  const [surface, setSurface] = useState<Surface>("store");
  const [storeCfg, setStoreCfg] = useState<SurfaceConfig>(store);
  const [courseCfg, setCourseCfg] = useState<SurfaceConfig>(course);

  const cfg = surface === "store" ? storeCfg : courseCfg;
  const setCfg = (next: SurfaceConfig) =>
    surface === "store" ? setStoreCfg(next) : setCourseCfg(next);
  const patch = (p: Partial<SurfaceConfig>) => setCfg({ ...cfg, ...p });
  const patchSection = (k: keyof SurfaceConfig["sections"], v: boolean) =>
    setCfg({ ...cfg, sections: { ...cfg.sections, [k]: v } });

  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await saveStorefrontDesignAction(surface, cfg);
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't save", description: res.message });
        return;
      }
      toast({ title: `${surface === "store" ? "Store" : "Course"} design saved` });
      router.refresh();
    });
  }

  const livePath = surface === "store" ? "/store" : "/course";

  return (
    <div className="space-y-6">
      {/* Surface tabs */}
      <div className="flex gap-2">
        {(["store", "course"] as Surface[]).map((s) => (
          <button
            key={s}
            onClick={() => setSurface(s)}
            className={
              "rounded-full px-4 py-2 text-sm font-medium capitalize transition " +
              (surface === s ? "bg-primary text-primary-foreground" : "border hover:bg-muted")
            }
          >
            {s} page
          </button>
        ))}
        {storeUrl && (
          <a
            href={`${storeUrl}${livePath}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto rounded-full border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            View live ↗
          </a>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Controls */}
        <div className="space-y-6">
          {/* Theme swatches */}
          <Section title="Theme">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {STOREFRONT_THEME_LIST.map((t) => (
                <button
                  key={t.key}
                  onClick={() => patch({ theme: t.key })}
                  className={
                    "relative flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition " +
                    (cfg.theme === t.key ? "border-primary ring-2 ring-primary/30" : "hover:border-primary")
                  }
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: t.swatch.bg }}>
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: t.swatch.accent }} />
                  </span>
                  <span className="truncate font-medium">{t.label}</span>
                  {cfg.theme === t.key && <Check className="ml-auto h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </Section>

          {/* Accent + font */}
          <Section title="Brand">
            <div className="flex flex-wrap gap-4">
              <div>
                <Label className="text-xs">Accent color (optional override)</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={cfg.accent ?? "#c9a14a"}
                    onChange={(e) => patch({ accent: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border"
                  />
                  {cfg.accent && (
                    <button onClick={() => patch({ accent: null })} className="text-xs text-muted-foreground underline">
                      use theme default
                    </button>
                  )}
                </div>
              </div>
              <div className="min-w-44 flex-1">
                <Label className="text-xs">Font</Label>
                <select
                  value={cfg.font ?? ""}
                  onChange={(e) => patch({ font: (e.target.value || null) as FontKey | null })}
                  className="mt-1 block h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Theme default</option>
                  {Object.entries(FONTS).map(([k, f]) => (
                    <option key={k} value={k}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          {/* Layout */}
          <Section title="Layout">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Pick label="Hero" value={cfg.hero} options={HEROES} onChange={(v) => patch({ hero: v })} />
              <Pick label="Cards" value={cfg.card} options={CARDS} onChange={(v) => patch({ card: v })} />
              <Pick label="Corners" value={cfg.radius} options={RADII} onChange={(v) => patch({ radius: v })} />
              <Pick label="Density" value={cfg.density} options={DENSITIES} onChange={(v) => patch({ density: v })} />
            </div>
          </Section>

          {/* Sections */}
          <Section title="Sections">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {([
                ["ratings", "Ratings & reviews"],
                ["badges", "Badges (sale/popular)"],
                ["related", "Related items"],
                ["trust", "Trust strip"],
                ["announcement", "Announcement bar"],
                ["promo", "Promo banner"],
              ] as [keyof SurfaceConfig["sections"], string][]).map(([k, label]) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={cfg.sections[k]} onChange={(e) => patchSection(k, e.target.checked)} className="h-4 w-4 accent-primary" />
                  {label}
                </label>
              ))}
            </div>
          </Section>

          {/* Copy */}
          <Section title="Copy">
            <div className="grid gap-3">
              <Field label="Headline (overrides your name)">
                <Input value={cfg.headline} onChange={(e) => patch({ headline: e.target.value })} placeholder="e.g. The Atelier" />
              </Field>
              <Field label="Tagline">
                <Input value={cfg.tagline} onChange={(e) => patch({ tagline: e.target.value })} placeholder="A short line under your name" />
              </Field>
              {cfg.sections.announcement && (
                <Field label="Announcement bar text">
                  <Input value={cfg.announcement} onChange={(e) => patch({ announcement: e.target.value })} placeholder="Free shipping over ₹999 ✦ Festive sale live" />
                </Field>
              )}
              {cfg.sections.promo && (
                <div className="grid gap-3 rounded-lg border p-3">
                  <Field label="Promo title">
                    <Input value={cfg.promoTitle} onChange={(e) => patch({ promoTitle: e.target.value })} placeholder="Festive Collection" />
                  </Field>
                  <Field label="Promo text">
                    <Input value={cfg.promoText} onChange={(e) => patch({ promoText: e.target.value })} placeholder="Up to 40% off, this week only" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Button label">
                      <Input value={cfg.promoCtaLabel} onChange={(e) => patch({ promoCtaLabel: e.target.value })} placeholder="Shop now" />
                    </Field>
                    <Field label="Button URL">
                      <Input value={cfg.promoCtaUrl} onChange={(e) => patch({ promoCtaUrl: e.target.value })} placeholder="/store" />
                    </Field>
                  </div>
                </div>
              )}
            </div>
          </Section>

          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save {surface} design
          </Button>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Live preview</p>
          <DesignPreview cfg={cfg} />
        </div>
      </div>
    </div>
  );
}

function DesignPreview({ cfg }: { cfg: SurfaceConfig }) {
  const vars = themeCssVars(cfg);
  return (
    <div className="sf-root overflow-hidden rounded-xl border" style={vars as React.CSSProperties}>
      {cfg.sections.announcement && cfg.announcement.trim() && (
        <div className="sf-accent-bg px-3 py-1.5 text-center text-[11px] font-medium">{cfg.announcement}</div>
      )}
      <div className="sf-band sf-border border-b px-4 py-6">
        <h3 className="sf-display text-xl font-bold">{cfg.headline.trim() || "Your store"}</h3>
        <p className="sf-muted mt-1 text-xs">{cfg.tagline.trim() || "Premium products, beautifully presented"}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4">
        {[1, 2].map((i) => (
          <div key={i} className={cardStylePreview(cfg.card)}>
            <div className="aspect-square w-full bg-gradient-to-br from-[var(--sf-bg2)] to-[var(--sf-surface)]" />
            <div className="p-2.5">
              <p className="sf-display truncate text-sm font-semibold">Sample product</p>
              <p className="sf-accent mt-0.5 text-[11px] font-semibold">★★★★★</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm font-bold">₹1,999</span>
                <span className="sf-btn px-2.5 py-1 text-[11px] font-semibold">Add</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function cardStylePreview(style: CardStyle): string {
  const base = "overflow-hidden ";
  switch (style) {
    case "glass":
      return base + "sf-card-glass";
    case "flat":
      return base + "sf-card border-transparent";
    case "bordered":
      return base + "sf-card";
    default:
      return base + "sf-card shadow-lg";
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Pick<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="mt-1 block h-9 w-full rounded-md border bg-background px-2 text-sm capitalize"
      >
        {options.map((o) => (
          <option key={o} value={o} className="capitalize">
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
