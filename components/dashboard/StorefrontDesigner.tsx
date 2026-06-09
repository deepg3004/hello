"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/hooks/use-toast";
import { saveStorefrontDesignAction, saveStorefrontChromeAction } from "@/actions/storefront";
import { FEATURE_ICON_MAP } from "@/components/store/featureIcons";
import { NAV_ICON_MAP } from "@/components/store/navIcons";
import {
  STOREFRONT_THEME_LIST,
  FONTS,
  themeCssVars,
  LEGAL_DOCS,
  FEATURE_ICONS,
  NAV_ICONS,
  SURFACES,
  type SurfaceConfig,
  type Surface,
  type ChromeConfig,
  type BottomNavItem,
  type MenuItem,
  type Banner,
  type Testimonial,
  type Faq,
  type Feature,
  type FontKey,
  type CardStyle,
  type RadiusKey,
  type DensityKey,
} from "@/lib/storefront-theme";

const CARDS: CardStyle[] = ["elevated", "bordered", "glass", "flat"];
const RADII: RadiusKey[] = ["sharp", "soft", "round"];
const DENSITIES: DensityKey[] = ["comfortable", "compact"];

type View = Surface | "chrome" | "analytics";

const LIVE_PATH: Record<Surface, string> = {
  home: "/",
  store: "/store",
  product: "/store",
  courses: "/course",
  course: "/course",
};

export interface StorefrontAnalytics {
  totalViews: number;
  topSources: { key: string; count: number }[];
  topDestinations: { key: string; count: number }[];
  topReferrers: { key: string; count: number }[];
}

export function StorefrontDesigner({
  configs,
  chrome,
  storeUrl,
  analytics,
}: {
  configs: Record<Surface, SurfaceConfig>;
  chrome: ChromeConfig;
  storeUrl: string | null;
  analytics: StorefrontAnalytics;
}) {
  const [view, setView] = useState<View>("home");
  const [cfgs, setCfgs] = useState<Record<Surface, SurfaceConfig>>(configs);
  const [chromeCfg, setChromeCfg] = useState<ChromeConfig>(chrome);

  const isSurface = (v: View): v is Surface => SURFACES.some((s) => s.key === v);
  const surface: Surface = isSurface(view) ? view : "home";
  const surfaceLabel = SURFACES.find((s) => s.key === surface)?.label ?? "Page";
  const cfg = cfgs[surface];
  const setCfg = (next: SurfaceConfig) => setCfgs((prev) => ({ ...prev, [surface]: next }));
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
      toast({ title: view === "chrome" ? "Header & footer saved" : `${surfaceLabel} design saved` });
      router.refresh();
    });
  }

  const livePath = LIVE_PATH[surface];

  const TABS: { key: View; label: string }[] = [
    ...SURFACES.map((s) => ({ key: s.key as View, label: s.label })),
    { key: "chrome", label: "Header & Footer" },
    { key: "analytics", label: "Analytics" },
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

      {view === "analytics" ? (
        <AnalyticsView analytics={analytics} />
      ) : view === "chrome" ? (
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Pick label="Cards" value={cfg.card} options={CARDS} onChange={(v) => patch({ card: v })} />
              <Pick label="Corners" value={cfg.radius} options={RADII} onChange={(v) => patch({ radius: v })} />
              <Pick label="Density" value={cfg.density} options={DENSITIES} onChange={(v) => patch({ density: v })} />
              <Pick label="Section align" value={cfg.sectionAlign} options={["left", "center"]} onChange={(v) => patch({ sectionAlign: v })} />
              <Pick label="Card border" value={cfg.cardBorder} options={["theme", "accent"]} onChange={(v) => patch({ cardBorder: v })} />
            </div>
          </Section>

          {/* Products per row */}
          <Section title="Products per row">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <NumberPick label="Desktop" value={cfg.cols.desktop} min={2} max={6} onChange={(v) => patch({ cols: { ...cfg.cols, desktop: v } })} />
              <NumberPick label="Tablet" value={cfg.cols.tablet} min={1} max={4} onChange={(v) => patch({ cols: { ...cfg.cols, tablet: v } })} />
              <NumberPick label="Mobile" value={cfg.cols.mobile} min={1} max={2} onChange={(v) => patch({ cols: { ...cfg.cols, mobile: v } })} />
            </div>
          </Section>

          {/* Banners */}
          <Section title="Banners (top of page)">
            {cfg.banners.length > 1 && (
              <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={cfg.bannerAutoplay} onChange={(e) => patch({ bannerAutoplay: e.target.checked })} className="h-4 w-4 accent-primary" />
                Auto-slide banners
              </label>
            )}
            <BannerEditor banners={cfg.banners} onChange={(banners) => patch({ banners })} />
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
                ["topSelling", "Top-selling row"],
                ["testimonials", "Testimonials"],
                ["faq", "FAQ"],
                ["features", "Features row"],
                ["brands", "Brand logos"],
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
            <Toggle label="Show Login / Sign up" checked={h.showAuth} onChange={(v) => setHeader({ showAuth: v })} />
          </div>
          <Field label="Logo links to (click destination)">
            <Input value={h.logoUrl} onChange={(e) => setHeader({ logoUrl: e.target.value })} placeholder="/ (home) — or /store, /course…" />
          </Field>
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

      {/* Legal & contact pages */}
      <Section title="Legal & contact pages">
        <p className="mb-3 text-xs text-muted-foreground">
          These show on your branded pages (with your header & footer) and link from your footer. Leave blank to show a “coming soon” note.
        </p>
        <div className="space-y-3">
          {LEGAL_DOCS.map((d) => (
            <Field key={d.key} label={d.label}>
              <textarea
                value={chrome.legal[d.key]}
                onChange={(e) => setChrome({ ...chrome, legal: { ...chrome.legal, [d.key]: e.target.value } })}
                rows={d.key === "contact" ? 3 : 5}
                placeholder={d.key === "contact" ? "Email, phone, address…" : `Your ${d.label.toLowerCase()} text…`}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </Field>
          ))}
        </div>
      </Section>

      {/* Testimonials */}
      <Section title="Testimonials">
        <p className="mb-3 text-xs text-muted-foreground">Shown on your store/course pages when the “Testimonials” section is on.</p>
        <TestimonialEditor items={chrome.testimonials} onChange={(testimonials) => setChrome({ ...chrome, testimonials })} />
      </Section>

      {/* FAQ */}
      <Section title="FAQ">
        <p className="mb-3 text-xs text-muted-foreground">
          Shown when the “FAQ” section is on. Text supports <strong>**bold**</strong>, *italic*, [links](url) and - lists.
        </p>
        <FaqEditor items={chrome.faqs} onChange={(faqs) => setChrome({ ...chrome, faqs })} />
      </Section>

      {/* Features */}
      <Section title="Features row (icons)">
        <p className="mb-3 text-xs text-muted-foreground">Shown when the “Features row” section is on — pick an icon or upload an image.</p>
        <FeaturesChromeEditor items={chrome.features} onChange={(features) => setChrome({ ...chrome, features })} />
      </Section>

      {/* Brand logos */}
      <Section title="Brand / partner logos">
        <p className="mb-3 text-xs text-muted-foreground">Auto-looping logo slider, shown when the “Brand logos” section is on.</p>
        <BrandLogosEditor logos={chrome.brandLogos} onChange={(brandLogos) => setChrome({ ...chrome, brandLogos })} />
      </Section>

      {/* Mobile bottom bar */}
      <Section title="Mobile bottom bar">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">App-style tab bar shown on phones. Hide, rename, re-icon or re-link any tab.</p>
          <Switch
            checked={chrome.bottomNav.enabled}
            onCheckedChange={(enabled) => setChrome({ ...chrome, bottomNav: { ...chrome.bottomNav, enabled } })}
          />
        </div>
        <BottomNavEditor
          items={chrome.bottomNav.items}
          onChange={(items) => setChrome({ ...chrome, bottomNav: { ...chrome.bottomNav, items } })}
        />
      </Section>

      <Button onClick={onSave} disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save header & footer
      </Button>
    </div>
  );
}

function TestimonialEditor({ items, onChange }: { items: Testimonial[]; onChange: (t: Testimonial[]) => void }) {
  const set = (i: number, p: Partial<Testimonial>) => onChange(items.map((t, idx) => (idx === i ? { ...t, ...p } : t)));
  return (
    <div className="space-y-3">
      {items.map((t, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Input value={t.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Name" className="w-40" />
              <select value={t.rating} onChange={(e) => set(i, { rating: Number(e.target.value) })} className="h-9 rounded-md border bg-background px-2 text-sm">
                {[5, 4, 3, 2, 1, 0].map((r) => (
                  <option key={r} value={r}>
                    {r === 0 ? "No stars" : `${r}★`}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Input value={t.role} onChange={(e) => set(i, { role: e.target.value })} placeholder="Role / company (optional)" />
          <textarea value={t.quote} onChange={(e) => set(i, { quote: e.target.value })} rows={2} placeholder="Their words…" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <ImageUpload value={t.avatar} onChange={(v) => set(i, { avatar: v })} placeholder="Avatar (optional)" />
        </div>
      ))}
      {items.length < 12 && (
        <Button variant="outline" size="sm" onClick={() => onChange([...items, { name: "", role: "", quote: "", avatar: "", rating: 5 }])}>
          <Plus className="mr-1.5 h-4 w-4" /> Add testimonial
        </Button>
      )}
    </div>
  );
}

function FaqEditor({ items, onChange }: { items: Faq[]; onChange: (f: Faq[]) => void }) {
  const set = (i: number, p: Partial<Faq>) => onChange(items.map((f, idx) => (idx === i ? { ...f, ...p } : f)));
  return (
    <div className="space-y-3">
      {items.map((f, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Input value={f.q} onChange={(e) => set(i, { q: e.target.value })} placeholder="Question" />
            <Button variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <textarea value={f.a} onChange={(e) => set(i, { a: e.target.value })} rows={2} placeholder="Answer" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
      ))}
      {items.length < 30 && (
        <Button variant="outline" size="sm" onClick={() => onChange([...items, { q: "", a: "" }])}>
          <Plus className="mr-1.5 h-4 w-4" /> Add FAQ
        </Button>
      )}
    </div>
  );
}

function AnalyticsView({ analytics }: { analytics: StorefrontAnalytics }) {
  const { totalViews, topSources, topDestinations, topReferrers } = analytics;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Page views (30 days)</p>
          <p className="mt-1 text-3xl font-bold">{totalViews.toLocaleString("en-IN")}</p>
        </div>
      </div>
      {totalViews === 0 ? (
        <p className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
          No visits recorded yet. Once buyers browse your storefront, you’ll see which pages they came from here.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <RankCard title="Top click sources" hint="Where visitors clicked the logo from" rows={topSources} />
          <RankCard title="Most-viewed pages" hint="Where visitors landed" rows={topDestinations} />
          <RankCard title="External referrers" hint="Sites that sent visitors" rows={topReferrers} />
        </div>
      )}
    </div>
  );
}

function RankCard({ title, hint, rows }: { title: string; hint: string; rows: { key: string; count: number }[] }) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mb-3 text-xs text-muted-foreground">{hint}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate" title={r.key}>{r.key}</span>
                <span className="shrink-0 font-medium tabular-nums">{r.count}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FeaturesChromeEditor({ items, onChange }: { items: Feature[]; onChange: (f: Feature[]) => void }) {
  const set = (i: number, p: Partial<Feature>) => onChange(items.map((f, idx) => (idx === i ? { ...f, ...p } : f)));
  return (
    <div className="space-y-3">
      {items.map((f, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {FEATURE_ICONS.map((key) => {
                const Icon = FEATURE_ICON_MAP[key];
                return (
                  <button
                    key={key}
                    onClick={() => set(i, { icon: f.icon === key ? "" : key, image: "" })}
                    title={key}
                    className={"flex h-7 w-7 items-center justify-center rounded border transition " + (f.icon === key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <ImageUpload value={f.image} onChange={(v) => set(i, { image: v, icon: "" })} placeholder="…or upload an image instead of an icon" />
          <Input value={f.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Title (e.g. Free shipping)" />
          <Input value={f.text} onChange={(e) => set(i, { text: e.target.value })} placeholder="Short text (supports **bold**, *italic*)" />
        </div>
      ))}
      {items.length < 8 && (
        <Button variant="outline" size="sm" onClick={() => onChange([...items, { icon: "truck", image: "", title: "", text: "" }])}>
          <Plus className="mr-1.5 h-4 w-4" /> Add feature
        </Button>
      )}
    </div>
  );
}

function BottomNavEditor({ items, onChange }: { items: BottomNavItem[]; onChange: (i: BottomNavItem[]) => void }) {
  const set = (i: number, p: Partial<BottomNavItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={it.key + i} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Switch checked={it.visible} onCheckedChange={(visible) => set(i, { visible })} />
              <span className="text-xs text-muted-foreground">{it.visible ? "Shown" : "Hidden"}</span>
              {it.type === "cart" && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Cart</span>}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">↓</Button>
              {it.type !== "cart" && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onChange(items.filter((_, idx) => idx !== i))} aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {NAV_ICONS.map((key) => {
              const Icon = NAV_ICON_MAP[key];
              return (
                <button
                  key={key}
                  onClick={() => set(i, { icon: key })}
                  title={key}
                  className={"flex h-7 w-7 items-center justify-center rounded border transition " + (it.icon === key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={it.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Label" />
            <Input
              value={it.url}
              onChange={(e) => set(i, { url: e.target.value })}
              placeholder={it.type === "cart" ? "Opens cart" : "/store"}
              disabled={it.type === "cart"}
            />
          </div>
        </div>
      ))}
      {items.length < 6 && (
        <Button variant="outline" size="sm" onClick={() => onChange([...items, { key: `c${items.length}`, type: "link", label: "", icon: "grid", url: "", visible: true }])}>
          <Plus className="mr-1.5 h-4 w-4" /> Add tab
        </Button>
      )}
    </div>
  );
}

function BrandLogosEditor({ logos, onChange }: { logos: string[]; onChange: (l: string[]) => void }) {
  return (
    <div className="space-y-2">
      {logos.map((url, i) => (
        <div key={i} className="flex items-center gap-2">
          <ImageUpload value={url} onChange={(v) => onChange(logos.map((l, idx) => (idx === i ? v : l)))} className="flex-1" previewClassName="h-10 w-16 rounded object-contain" />
          <Button variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => onChange(logos.filter((_, idx) => idx !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {logos.length < 24 && (
        <Button variant="outline" size="sm" onClick={() => onChange([...logos, ""])}>
          <Plus className="mr-1.5 h-4 w-4" /> Add logo
        </Button>
      )}
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

function NumberPick({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const opts = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 block h-9 w-full rounded-md border bg-background px-2 text-sm">
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function BannerEditor({ banners, onChange }: { banners: Banner[]; onChange: (b: Banner[]) => void }) {
  const set = (i: number, p: Partial<Banner>) => onChange(banners.map((b, idx) => (idx === i ? { ...b, ...p } : b)));
  const add = () => onChange([...banners, { type: "image", image: "", title: "", subtitle: "", ctaLabel: "", ctaUrl: "", align: "left" }]);
  return (
    <div className="space-y-3">
      {banners.map((b, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <select value={b.type} onChange={(e) => set(i, { type: e.target.value as Banner["type"] })} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="image">Image banner</option>
                <option value="text">Text banner</option>
              </select>
              <select value={b.align} onChange={(e) => set(i, { align: e.target.value as Banner["align"] })} className="h-9 rounded-md border bg-background px-2 text-sm" title="Content alignment">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onChange(banners.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {b.type === "image" && <ImageUpload value={b.image} onChange={(v) => set(i, { image: v })} placeholder="Banner image" previewClassName="h-10 w-16 rounded object-cover" />}
          <Input value={b.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Banner title" />
          <Input value={b.subtitle} onChange={(e) => set(i, { subtitle: e.target.value })} placeholder="Subtitle (optional)" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={b.ctaLabel} onChange={(e) => set(i, { ctaLabel: e.target.value })} placeholder="Button label" />
            <Input value={b.ctaUrl} onChange={(e) => set(i, { ctaUrl: e.target.value })} placeholder="/store or https://…" />
          </div>
        </div>
      ))}
      {banners.length < 6 && (
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="mr-1.5 h-4 w-4" /> Add banner
        </Button>
      )}
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
