"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/hooks/use-toast";
import { saveStorefrontDesignAction, saveStorefrontChromeAction } from "@/actions/storefront";
import {
  STOREFRONT_THEME_LIST,
  FONTS,
  themeCssVars,
  type SurfaceConfig,
  type Surface,
  type ChromeConfig,
  type MenuItem,
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

type View = "store" | "course" | "chrome";

export function StorefrontDesigner({
  store,
  course,
  chrome,
  storeUrl,
}: {
  store: SurfaceConfig;
  course: SurfaceConfig;
  chrome: ChromeConfig;
  storeUrl: string | null;
}) {
  const [view, setView] = useState<View>("store");
  const [storeCfg, setStoreCfg] = useState<SurfaceConfig>(store);
  const [courseCfg, setCourseCfg] = useState<SurfaceConfig>(course);
  const [chromeCfg, setChromeCfg] = useState<ChromeConfig>(chrome);

  const surface: Surface = view === "course" ? "course" : "store";
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
      const res = view === "chrome"
        ? await saveStorefrontChromeAction(chromeCfg)
        : await saveStorefrontDesignAction(surface, cfg);
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't save", description: res.message });
        return;
      }
      toast({ title: view === "chrome" ? "Header & footer saved" : `${surface === "store" ? "Store" : "Course"} design saved` });
      router.refresh();
    });
  }

  const livePath = view === "course" ? "/course" : "/store";

  const TABS: { key: View; label: string }[] = [
    { key: "store", label: "Store page" },
    { key: "course", label: "Course page" },
    { key: "chrome", label: "Header & Footer" },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={
              "rounded-full px-4 py-2 text-sm font-medium transition " +
              (view === t.key ? "bg-primary text-primary-foreground" : "border hover:bg-muted")
            }
          >
            {t.label}
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

      {view === "chrome" ? (
        <ChromeEditor chrome={chromeCfg} setChrome={setChromeCfg} onSave={save} pending={pending} />
      ) : (
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

          {/* Branding */}
          <Section title="Branding">
            <div className="grid gap-3">
              <Field label="Logo (shown in the header)">
                <ImageUpload value={cfg.logo} onChange={(v) => patch({ logo: v })} placeholder="Upload or paste a logo URL" previewClassName="h-10 w-16 rounded object-contain" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Favicon (browser tab icon)">
                  <ImageUpload value={cfg.favicon} onChange={(v) => patch({ favicon: v })} placeholder="32×32 PNG/ICO" />
                </Field>
                <Field label="Browser tab / SEO title">
                  <Input value={cfg.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. The Atelier — Premium Store" />
                </Field>
              </div>
            </div>
          </Section>

          {/* Accent + font */}
          <Section title="Colors & type">
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
      )}
    </div>
  );
}

function ChromeEditor({
  chrome,
  setChrome,
  onSave,
  pending,
}: {
  chrome: ChromeConfig;
  setChrome: (c: ChromeConfig) => void;
  onSave: () => void;
  pending: boolean;
}) {
  const h = chrome.header;
  const f = chrome.footer;
  const setHeader = (p: Partial<ChromeConfig["header"]>) => setChrome({ ...chrome, header: { ...h, ...p } });
  const setFooter = (p: Partial<ChromeConfig["footer"]>) => setChrome({ ...chrome, footer: { ...f, ...p } });

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <Section title="Header & navigation menu">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Toggle label="Show header" checked={h.enabled} onChange={(v) => setHeader({ enabled: v })} />
            <Toggle label="Sticky on scroll" checked={h.sticky} onChange={(v) => setHeader({ sticky: v })} />
          </div>
          <div>
            <Label className="text-xs">Menu links</Label>
            <MenuEditor items={h.menu} onChange={(menu) => setHeader({ menu })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Header button label">
              <Input value={h.ctaLabel} onChange={(e) => setHeader({ ctaLabel: e.target.value })} placeholder="e.g. Contact" />
            </Field>
            <Field label="Header button URL">
              <Input value={h.ctaUrl} onChange={(e) => setHeader({ ctaUrl: e.target.value })} placeholder="/contact or https://…" />
            </Field>
          </div>
        </div>
      </Section>

      {/* Footer */}
      <Section title="Footer">
        <div className="space-y-4">
          <Toggle label="Show footer" checked={f.enabled} onChange={(v) => setFooter({ enabled: v })} />
          <Field label="Footer text (defaults to © your name)">
            <Input value={f.text} onChange={(e) => setFooter({ text: e.target.value })} placeholder="© 2026 Your Brand. All rights reserved." />
          </Field>
          <div>
            <Label className="text-xs">Social links</Label>
            <MenuEditor items={f.socials} onChange={(socials) => setFooter({ socials })} labelPlaceholder="Instagram" urlPlaceholder="https://instagram.com/you" />
          </div>
          <div>
            <Label className="text-xs">Footer columns</Label>
            <div className="mt-1 space-y-3">
              {f.columns.map((col, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={col.title}
                      placeholder="Column title (e.g. Company)"
                      onChange={(e) => setFooter({ columns: f.columns.map((c, idx) => (idx === i ? { ...c, title: e.target.value } : c)) })}
                    />
                    <Button variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => setFooter({ columns: f.columns.filter((_, idx) => idx !== i) })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2">
                    <MenuEditor items={col.links} onChange={(links) => setFooter({ columns: f.columns.map((c, idx) => (idx === i ? { ...c, links } : c)) })} />
                  </div>
                </div>
              ))}
              {f.columns.length < 5 && (
                <Button variant="outline" size="sm" onClick={() => setFooter({ columns: [...f.columns, { title: "", links: [] }] })}>
                  <Plus className="mr-1.5 h-4 w-4" /> Add footer column
                </Button>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Button onClick={onSave} disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save header & footer
      </Button>
    </div>
  );
}

function MenuEditor({
  items,
  onChange,
  labelPlaceholder = "Label",
  urlPlaceholder = "/store or https://…",
}: {
  items: MenuItem[];
  onChange: (items: MenuItem[]) => void;
  labelPlaceholder?: string;
  urlPlaceholder?: string;
}) {
  const set = (i: number, p: Partial<MenuItem>) => onChange(items.map((m, idx) => (idx === i ? { ...m, ...p } : m)));
  return (
    <div className="mt-1 space-y-2">
      {items.map((m, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={m.label} placeholder={labelPlaceholder} className="w-40" onChange={(e) => set(i, { label: e.target.value })} />
          <Input value={m.url} placeholder={urlPlaceholder} className="flex-1" onChange={(e) => set(i, { url: e.target.value })} />
          <Button variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {items.length < 12 && (
        <Button variant="outline" size="sm" onClick={() => onChange([...items, { label: "", url: "" }])}>
          <Plus className="mr-1.5 h-4 w-4" /> Add link
        </Button>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-primary" />
      {label}
    </label>
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
