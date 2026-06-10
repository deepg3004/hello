// =============================================================================
// Storefront theming — premium, seller-editable themes for the store + course
// pages. A theme is a set of CSS-variable tokens (--sf-*) plus style flags
// (font pairing, hero style, card style, radius). Sellers pick a ready theme
// and may override accent / font / hero / card / radius / density, toggle
// sections, and set custom copy. Stored per-surface in
// user_profiles.storefront_config = { store: SurfaceConfig, course: SurfaceConfig }.
// =============================================================================

export const SURFACES = [
  { key: "home", label: "Home" },
  { key: "store", label: "Store catalog" },
  { key: "product", label: "Product page" },
  { key: "courses", label: "Course catalog" },
  { key: "course", label: "Course page" },
] as const;
export type Surface = (typeof SURFACES)[number]["key"];

// When a page has no saved config yet, fall back to a related page's config so
// a seller's existing store/course settings carry over to the new sub-pages.
const SURFACE_FALLBACK: Record<Surface, Surface | null> = {
  home: "store",
  store: null,
  product: "store",
  courses: "course",
  course: null,
};

export interface StorefrontTheme {
  key: string;
  label: string;
  dark: boolean;
  vars: {
    bg: string;
    bg2: string; // hero / banded background
    surface: string; // cards
    fg: string;
    muted: string;
    border: string;
    accent: string;
    accentFg: string;
  };
  defaultFont: FontKey;
  /** swatch shown in the picker */
  swatch: { bg: string; accent: string };
}

export type FontKey = "serif-display" | "modern-sans" | "rounded" | "grotesk" | "mono-accent";
export type HeroStyle = "banner" | "gradient" | "minimal" | "split";
export type CardStyle = "elevated" | "bordered" | "glass" | "flat";
export type RadiusKey = "sharp" | "soft" | "round";
export type DensityKey = "comfortable" | "compact";

export const FONTS: Record<FontKey, { label: string; display: string; body: string }> = {
  "serif-display": {
    label: "Serif display",
    display: "'Playfair Display', Georgia, 'Times New Roman', serif",
    body: "'Inter', system-ui, sans-serif",
  },
  "modern-sans": {
    label: "Modern sans",
    display: "'Sora', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
  },
  rounded: {
    label: "Rounded",
    display: "'Quicksand', 'Nunito', system-ui, sans-serif",
    body: "'Nunito', system-ui, sans-serif",
  },
  grotesk: {
    label: "Grotesk",
    display: "'Space Grotesk', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
  },
  "mono-accent": {
    label: "Mono accent",
    display: "'Space Mono', ui-monospace, monospace",
    body: "'Inter', system-ui, sans-serif",
  },
};

export const RADIUS: Record<RadiusKey, string> = {
  sharp: "0.25rem",
  soft: "0.85rem",
  round: "1.4rem",
};

// ── Ready themes ─────────────────────────────────────────────────────────────
export const STOREFRONT_THEMES: Record<string, StorefrontTheme> = {
  "modern-lite": {
    key: "modern-lite", label: "Modern Lite", dark: false,
    vars: { bg: "#ffffff", bg2: "#f6f8fc", surface: "#ffffff", fg: "#0f172a", muted: "#64748b", border: "#e6eaf2", accent: "#2563eb", accentFg: "#ffffff" },
    defaultFont: "modern-sans",
    swatch: { bg: "#f6f8fc", accent: "#2563eb" },
  },
  "modern-dark-glass": {
    key: "modern-dark-glass", label: "Modern Dark Glass", dark: true,
    vars: { bg: "#080d1c", bg2: "#0f172a", surface: "rgba(17,26,48,0.72)", fg: "#eef2ff", muted: "#9aa6c4", border: "rgba(124,58,237,0.22)", accent: "#7c3aed", accentFg: "#ffffff" },
    defaultFont: "modern-sans",
    swatch: { bg: "#080d1c", accent: "#7c3aed" },
  },
  "luxe-noir": {
    key: "luxe-noir", label: "Luxe Noir", dark: true,
    vars: { bg: "#0b0b0f", bg2: "#101017", surface: "#16161f", fg: "#f6f1e7", muted: "#a8a29e", border: "rgba(201,161,74,0.18)", accent: "#c9a14a", accentFg: "#1a1408" },
    defaultFont: "serif-display",
    swatch: { bg: "#0b0b0f", accent: "#c9a14a" },
  },
  "royal-velvet": {
    key: "royal-velvet", label: "Royal Velvet", dark: true,
    vars: { bg: "#140b22", bg2: "#1b1030", surface: "#221540", fg: "#f3ecff", muted: "#c4b5e0", border: "rgba(192,132,252,0.20)", accent: "#c084fc", accentFg: "#1a0b2e" },
    defaultFont: "serif-display",
    swatch: { bg: "#140b22", accent: "#c084fc" },
  },
  "emerald-lux": {
    key: "emerald-lux", label: "Emerald Lux", dark: true,
    vars: { bg: "#06231c", bg2: "#0a2d23", surface: "#0d3a2d", fg: "#ecfdf5", muted: "#a7d8c4", border: "rgba(52,211,153,0.20)", accent: "#34d399", accentFg: "#04231a" },
    defaultFont: "grotesk",
    swatch: { bg: "#06231c", accent: "#34d399" },
  },
  "ocean-deep": {
    key: "ocean-deep", label: "Ocean Deep", dark: true,
    vars: { bg: "#0a1626", bg2: "#0d1d33", surface: "#102540", fg: "#eef6ff", muted: "#9fb8d4", border: "rgba(56,189,248,0.20)", accent: "#38bdf8", accentFg: "#04121f" },
    defaultFont: "modern-sans",
    swatch: { bg: "#0a1626", accent: "#38bdf8" },
  },
  "mono-slate": {
    key: "mono-slate", label: "Mono Slate", dark: true,
    vars: { bg: "#0c0d10", bg2: "#141519", surface: "#1a1c21", fg: "#f4f4f5", muted: "#a1a1aa", border: "rgba(255,255,255,0.10)", accent: "#e4e4e7", accentFg: "#18181b" },
    defaultFont: "mono-accent",
    swatch: { bg: "#0c0d10", accent: "#e4e4e7" },
  },
  "aurora-glass": {
    key: "aurora-glass", label: "Aurora Glass", dark: false,
    vars: { bg: "#f5f3ff", bg2: "#ede9fe", surface: "rgba(255,255,255,0.72)", fg: "#1e1b2e", muted: "#6d6a85", border: "rgba(124,58,237,0.16)", accent: "#7c3aed", accentFg: "#ffffff" },
    defaultFont: "grotesk",
    swatch: { bg: "#ede9fe", accent: "#7c3aed" },
  },
  "minimal-editorial": {
    key: "minimal-editorial", label: "Minimal Editorial", dark: false,
    vars: { bg: "#ffffff", bg2: "#fafafa", surface: "#ffffff", fg: "#18181b", muted: "#71717a", border: "#e4e4e7", accent: "#111114", accentFg: "#ffffff" },
    defaultFont: "serif-display",
    swatch: { bg: "#ffffff", accent: "#111114" },
  },
  "bold-pop": {
    key: "bold-pop", label: "Bold Pop", dark: false,
    vars: { bg: "#fffbeb", bg2: "#fef3c7", surface: "#ffffff", fg: "#1c1410", muted: "#78716c", border: "#1c1410", accent: "#ec4899", accentFg: "#ffffff" },
    defaultFont: "grotesk",
    swatch: { bg: "#fffbeb", accent: "#ec4899" },
  },
  "sunset-coral": {
    key: "sunset-coral", label: "Sunset Coral", dark: false,
    vars: { bg: "#fff7f3", bg2: "#ffe9e0", surface: "#ffffff", fg: "#2a1712", muted: "#8a6f66", border: "rgba(251,113,133,0.22)", accent: "#fb7185", accentFg: "#ffffff" },
    defaultFont: "rounded",
    swatch: { bg: "#ffe9e0", accent: "#fb7185" },
  },
  "rose-cream": {
    key: "rose-cream", label: "Rose Cream", dark: false,
    vars: { bg: "#fff7f8", bg2: "#fdecef", surface: "#ffffff", fg: "#2a121a", muted: "#8a6470", border: "rgba(225,29,72,0.18)", accent: "#e11d48", accentFg: "#ffffff" },
    defaultFont: "serif-display",
    swatch: { bg: "#fdecef", accent: "#e11d48" },
  },
};

export const STOREFRONT_THEME_LIST = Object.values(STOREFRONT_THEMES);
export const DEFAULT_THEME = "modern-lite";

export interface SurfaceConfig {
  theme: string;
  accent: string | null; // override
  font: FontKey | null; // override
  hero: HeroStyle;
  card: CardStyle;
  radius: RadiusKey;
  density: DensityKey;
  sections: {
    ratings: boolean;
    badges: boolean;
    related: boolean;
    trust: boolean;
    announcement: boolean;
    promo: boolean;
    topSelling: boolean;
    testimonials: boolean;
    faq: boolean;
    brands: boolean;
    features: boolean;
  };
  sectionAlign: "left" | "center";
  cardBorder: "theme" | "accent";
  headline: string;
  tagline: string;
  announcement: string;
  promoTitle: string;
  promoText: string;
  promoCtaLabel: string;
  promoCtaUrl: string;
  // Branding
  logo: string; // image URL shown in the hero
  favicon: string; // browser tab icon
  title: string; // browser tab / SEO title
  // Banners (replace the hero) + responsive grid columns
  banners: Banner[];
  bannerAutoplay: boolean;
  cols: { desktop: number; tablet: number; mobile: number };
}

export type Align = "left" | "center" | "right";

export interface Banner {
  type: "image" | "text";
  image: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaUrl: string;
  align: Align;
}

export function defaultSurfaceConfig(): SurfaceConfig {
  return {
    theme: DEFAULT_THEME,
    accent: null,
    font: null,
    hero: "banner",
    card: "elevated",
    radius: "soft",
    density: "comfortable",
    sections: { ratings: true, badges: true, related: true, trust: true, announcement: false, promo: false, topSelling: false, testimonials: false, faq: false, brands: false, features: false },
    sectionAlign: "left",
    cardBorder: "theme",
    headline: "",
    tagline: "",
    announcement: "",
    promoTitle: "",
    promoText: "",
    promoCtaLabel: "",
    promoCtaUrl: "",
    logo: "",
    favicon: "",
    title: "",
    banners: [],
    bannerAutoplay: true,
    cols: { desktop: 4, tablet: 3, mobile: 2 },
  };
}

function cleanBanners(v: unknown): Banner[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((b) => {
      const o = (b ?? {}) as Record<string, unknown>;
      const type = o.type === "text" ? "text" : "image";
      const s = (x: unknown) => (typeof x === "string" ? x.trim().slice(0, 500) : "");
      const align: Align = o.align === "left" || o.align === "right" ? o.align : "left";
      return {
        type: type as "image" | "text",
        image: s(o.image),
        title: s(o.title),
        subtitle: s(o.subtitle),
        ctaLabel: s(o.ctaLabel),
        ctaUrl: s(o.ctaUrl),
        align,
      };
    })
    .filter((b) => b.image || b.title || b.subtitle)
    .slice(0, 6);
}

function clampCol(v: unknown, def: number, min: number, max: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

/** Tailwind grid-cols class for the configured per-device columns. The literal
 *  classes below ensure Tailwind keeps them at build time. */
export function gridColsClass(cols: { desktop: number; tablet: number; mobile: number }): string {
  const m: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2" };
  const t: Record<number, string> = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" };
  const d: Record<number, string> = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" };
  return [m[cols.mobile] ?? "grid-cols-2", t[cols.tablet] ?? "sm:grid-cols-3", d[cols.desktop] ?? "lg:grid-cols-4"].join(" ");
}

/** Merge a stored (possibly partial) config for a surface with defaults. */
export function resolveSurfaceConfig(raw: unknown, surface: Surface): SurfaceConfig {
  const base = defaultSurfaceConfig();
  const root = (raw ?? {}) as Record<string, unknown>;
  const fb = SURFACE_FALLBACK[surface];
  const raw0 = root[surface] ?? (fb ? root[fb] : undefined);
  const s = (raw0 ?? {}) as Partial<SurfaceConfig> & { sections?: Partial<SurfaceConfig["sections"]> };
  const themeKey = typeof s.theme === "string" && STOREFRONT_THEMES[s.theme] ? s.theme : base.theme;
  return {
    theme: themeKey,
    accent: typeof s.accent === "string" && s.accent ? s.accent : null,
    font: (s.font && FONTS[s.font] ? s.font : null) as FontKey | null,
    hero: (s.hero ?? base.hero) as HeroStyle,
    card: (s.card ?? base.card) as CardStyle,
    radius: (s.radius && RADIUS[s.radius] ? s.radius : base.radius) as RadiusKey,
    density: (s.density ?? base.density) as DensityKey,
    sections: { ...base.sections, ...(s.sections ?? {}) },
    sectionAlign: s.sectionAlign === "center" ? "center" : "left",
    cardBorder: s.cardBorder === "accent" ? "accent" : "theme",
    headline: typeof s.headline === "string" ? s.headline : "",
    tagline: typeof s.tagline === "string" ? s.tagline : "",
    announcement: typeof s.announcement === "string" ? s.announcement : "",
    promoTitle: typeof s.promoTitle === "string" ? s.promoTitle : "",
    promoText: typeof s.promoText === "string" ? s.promoText : "",
    promoCtaLabel: typeof s.promoCtaLabel === "string" ? s.promoCtaLabel : "",
    promoCtaUrl: typeof s.promoCtaUrl === "string" ? s.promoCtaUrl : "",
    logo: typeof s.logo === "string" ? s.logo : "",
    favicon: typeof s.favicon === "string" ? s.favicon : "",
    title: typeof s.title === "string" ? s.title : "",
    banners: cleanBanners(s.banners),
    bannerAutoplay: typeof s.bannerAutoplay === "boolean" ? s.bannerAutoplay : true,
    cols: {
      desktop: clampCol((s.cols as Record<string, unknown> | undefined)?.desktop, 4, 2, 6),
      tablet: clampCol((s.cols as Record<string, unknown> | undefined)?.tablet, 3, 1, 4),
      mobile: clampCol((s.cols as Record<string, unknown> | undefined)?.mobile, 2, 1, 2),
    },
  };
}

/** CSS custom properties for a resolved config — spread onto the shell wrapper. */
export function themeCssVars(cfg: SurfaceConfig): Record<string, string> {
  const theme = STOREFRONT_THEMES[cfg.theme] ?? STOREFRONT_THEMES[DEFAULT_THEME];
  const accent = cfg.accent ?? theme.vars.accent;
  const fontKey = cfg.font ?? theme.defaultFont;
  const font = FONTS[fontKey];
  // "accent" card border tints every border with the accent colour.
  const border = cfg.cardBorder === "accent" ? accent : theme.vars.border;
  return {
    "--sf-bg": theme.vars.bg,
    "--sf-bg2": theme.vars.bg2,
    "--sf-surface": theme.vars.surface,
    "--sf-fg": theme.vars.fg,
    "--sf-muted": theme.vars.muted,
    "--sf-border": border,
    "--sf-accent": accent,
    "--sf-accent-fg": theme.vars.accentFg,
    "--sf-radius": RADIUS[cfg.radius],
    "--sf-display": font.display,
    "--sf-body": font.body,
  } as Record<string, string>;
}

export function isDarkTheme(cfg: SurfaceConfig): boolean {
  return (STOREFRONT_THEMES[cfg.theme] ?? STOREFRONT_THEMES[DEFAULT_THEME]).dark;
}

// ── Header / footer / menu (shared "chrome" across all storefront surfaces) ──
export interface MenuItem {
  label: string;
  url: string;
}
export interface FooterColumn {
  title: string;
  links: MenuItem[];
}
/** Curated icon keys for the mobile bottom nav (mapped to lucide in the UI). */
export const NAV_ICONS = [
  "home", "store", "bag", "grid", "graduation", "book", "cart", "user",
  "heart", "search", "phone", "info", "sparkles", "tag", "gift", "calendar",
] as const;
export type NavIcon = (typeof NAV_ICONS)[number];

export interface BottomNavItem {
  key: string;
  type: "link" | "cart"; // cart opens the cart drawer; link navigates to url
  label: string;
  icon: string; // a NAV_ICONS key
  url: string; // used when type === "link"
  visible: boolean;
}

export interface ChromeConfig {
  header: {
    enabled: boolean;
    sticky: boolean;
    menu: MenuItem[];
    ctaLabel: string;
    ctaUrl: string;
    logoUrl: string; // where the logo links (default "/")
    showAuth: boolean; // show buyer Login / Sign up
  };
  /** Mobile app-style bottom tab bar (phones only). Seller-configurable. */
  bottomNav: { enabled: boolean; items: BottomNavItem[] };
  footer: {
    enabled: boolean;
    text: string;
    columns: FooterColumn[];
    socials: MenuItem[];
  };
  legal: { privacy: string; terms: string; refund: string; contact: string };
  testimonials: Testimonial[];
  faqs: Faq[];
  brandLogos: string[];
  features: Feature[];
}

export interface Feature {
  icon: string; // a curated icon key (see FEATURE_ICONS) or empty
  image: string; // optional image instead of an icon
  title: string;
  text: string;
}

export interface Testimonial {
  name: string;
  role: string;
  quote: string;
  avatar: string;
  rating: number;
}
export interface Faq {
  q: string;
  a: string;
}

export const LEGAL_DOCS = [
  { key: "privacy", label: "Privacy Policy" },
  { key: "terms", label: "Terms of Service" },
  { key: "refund", label: "Refund Policy" },
  { key: "contact", label: "Contact Us" },
] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number]["key"];

/** Default mobile bottom-nav items (Home · Store · Courses · Cart · Account). */
export function defaultBottomNav(): ChromeConfig["bottomNav"] {
  return {
    enabled: true,
    items: [
      { key: "home", type: "link", label: "Home", icon: "home", url: "/", visible: true },
      { key: "store", type: "link", label: "Store", icon: "store", url: "/store", visible: true },
      { key: "courses", type: "link", label: "Courses", icon: "graduation", url: "/course", visible: true },
      { key: "cart", type: "cart", label: "Cart", icon: "cart", url: "", visible: true },
      { key: "account", type: "link", label: "Account", icon: "user", url: "/account", visible: true },
    ],
  };
}

export function defaultChromeConfig(): ChromeConfig {
  return {
    header: {
      enabled: true,
      sticky: true,
      menu: [
        { label: "Home", url: "/" },
        { label: "Store", url: "/store" },
        { label: "Courses", url: "/course" },
      ],
      ctaLabel: "",
      ctaUrl: "",
      logoUrl: "/",
      showAuth: true,
    },
    bottomNav: defaultBottomNav(),
    footer: {
      enabled: true,
      text: "",
      columns: [],
      socials: [],
    },
    legal: { privacy: "", terms: "", refund: "", contact: "" },
    testimonials: [],
    faqs: [],
    brandLogos: [],
    features: [],
  };
}

/** Curated icon keys for the Features section (mapped to lucide in the UI). */
export const FEATURE_ICONS = [
  "truck", "shield", "rotate", "headphones", "tag", "gift", "star", "zap",
  "heart", "award", "clock", "lock", "leaf", "globe", "sparkles", "check",
] as const;

function cleanMenu(v: unknown, max = 12): MenuItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((m) => {
      const o = (m ?? {}) as Record<string, unknown>;
      return {
        label: typeof o.label === "string" ? o.label.trim().slice(0, 60) : "",
        url: typeof o.url === "string" ? o.url.trim().slice(0, 400) : "",
      };
    })
    .filter((m) => m.label && m.url)
    .slice(0, max);
}

function cleanBottomNav(v: unknown): ChromeConfig["bottomNav"] {
  const def = defaultBottomNav();
  if (!v || typeof v !== "object") return def;
  const o = v as Record<string, unknown>;
  const enabled = typeof o.enabled === "boolean" ? o.enabled : true;
  if (!Array.isArray(o.items)) return { enabled, items: def.items };
  const items = (o.items as unknown[])
    .map((it) => {
      const r = (it ?? {}) as Record<string, unknown>;
      const type: "link" | "cart" = r.type === "cart" ? "cart" : "link";
      return {
        key: typeof r.key === "string" && r.key ? r.key.slice(0, 32) : "item",
        type,
        label: typeof r.label === "string" ? r.label.trim().slice(0, 20) : "",
        icon: typeof r.icon === "string" && r.icon ? r.icon.slice(0, 24) : "grid",
        url: typeof r.url === "string" ? r.url.trim().slice(0, 400) : "",
        visible: typeof r.visible === "boolean" ? r.visible : true,
      };
    })
    .filter((it) => it.label && (it.type === "cart" || it.url))
    .slice(0, 6);
  return { enabled, items: items.length ? items : def.items };
}

/** Merge stored (possibly partial) chrome with defaults. */
export function resolveChromeConfig(raw: unknown): ChromeConfig {
  const base = defaultChromeConfig();
  const root = (raw ?? {}) as Record<string, unknown>;
  const c = (root.chrome ?? {}) as Record<string, unknown>;
  const h = (c.header ?? {}) as Record<string, unknown>;
  const f = (c.footer ?? {}) as Record<string, unknown>;
  const menu = c.header !== undefined ? cleanMenu(h.menu) : base.header.menu;
  return {
    header: {
      enabled: typeof h.enabled === "boolean" ? h.enabled : base.header.enabled,
      sticky: typeof h.sticky === "boolean" ? h.sticky : base.header.sticky,
      menu,
      ctaLabel: typeof h.ctaLabel === "string" ? h.ctaLabel : "",
      ctaUrl: typeof h.ctaUrl === "string" ? h.ctaUrl : "",
      logoUrl: typeof h.logoUrl === "string" && h.logoUrl.trim() ? h.logoUrl.trim() : "/",
      showAuth: typeof h.showAuth === "boolean" ? h.showAuth : true,
    },
    bottomNav: c.bottomNav !== undefined ? cleanBottomNav(c.bottomNav) : base.bottomNav,
    footer: {
      enabled: typeof f.enabled === "boolean" ? f.enabled : base.footer.enabled,
      text: typeof f.text === "string" ? f.text : "",
      columns: Array.isArray(f.columns)
        ? (f.columns as unknown[])
            .map((col) => {
              const o = (col ?? {}) as Record<string, unknown>;
              return { title: typeof o.title === "string" ? o.title.trim().slice(0, 60) : "", links: cleanMenu(o.links) };
            })
            .filter((col) => col.title || col.links.length)
            .slice(0, 5)
        : [],
      socials: cleanMenu(f.socials, 8),
    },
    legal: {
      privacy: typeof (c.legal as Record<string, unknown> | undefined)?.privacy === "string" ? String((c.legal as Record<string, unknown>).privacy).slice(0, 20000) : "",
      terms: typeof (c.legal as Record<string, unknown> | undefined)?.terms === "string" ? String((c.legal as Record<string, unknown>).terms).slice(0, 20000) : "",
      refund: typeof (c.legal as Record<string, unknown> | undefined)?.refund === "string" ? String((c.legal as Record<string, unknown>).refund).slice(0, 20000) : "",
      contact: typeof (c.legal as Record<string, unknown> | undefined)?.contact === "string" ? String((c.legal as Record<string, unknown>).contact).slice(0, 20000) : "",
    },
    testimonials: cleanTestimonials(c.testimonials),
    faqs: cleanFaqs(c.faqs),
    brandLogos: Array.isArray(c.brandLogos)
      ? (c.brandLogos as unknown[]).map((x) => (typeof x === "string" ? x.trim() : "")).filter((x) => /^https?:\/\//i.test(x)).slice(0, 24)
      : [],
    features: cleanFeatures(c.features),
  };
}

function cleanFeatures(v: unknown): Feature[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((f) => {
      const o = (f ?? {}) as Record<string, unknown>;
      const s = (x: unknown, n: number) => (typeof x === "string" ? x.trim().slice(0, n) : "");
      return { icon: s(o.icon, 30), image: s(o.image, 400), title: s(o.title, 80), text: s(o.text, 300) };
    })
    .filter((f) => f.title || f.text)
    .slice(0, 8);
}

function cleanTestimonials(v: unknown): Testimonial[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((t) => {
      const o = (t ?? {}) as Record<string, unknown>;
      const s = (x: unknown, n: number) => (typeof x === "string" ? x.trim().slice(0, n) : "");
      const r = Math.round(Number(o.rating));
      return {
        name: s(o.name, 80),
        role: s(o.role, 80),
        quote: s(o.quote, 600),
        avatar: s(o.avatar, 400),
        rating: Number.isFinite(r) ? Math.min(5, Math.max(0, r)) : 5,
      };
    })
    .filter((t) => t.quote || t.name)
    .slice(0, 12);
}
function cleanFaqs(v: unknown): Faq[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((f) => {
      const o = (f ?? {}) as Record<string, unknown>;
      const s = (x: unknown, n: number) => (typeof x === "string" ? x.trim().slice(0, n) : "");
      return { q: s(o.q, 300), a: s(o.a, 3000) };
    })
    .filter((f) => f.q && f.a)
    .slice(0, 30);
}
