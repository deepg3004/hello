// =============================================================================
// Storefront theming — premium, seller-editable themes for the store + course
// pages. A theme is a set of CSS-variable tokens (--sf-*) plus style flags
// (font pairing, hero style, card style, radius). Sellers pick a ready theme
// and may override accent / font / hero / card / radius / density, toggle
// sections, and set custom copy. Stored per-surface in
// user_profiles.storefront_config = { store: SurfaceConfig, course: SurfaceConfig }.
// =============================================================================

export type Surface = "store" | "course";

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
export const DEFAULT_THEME = "luxe-noir";

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
  };
  headline: string;
  tagline: string;
  announcement: string;
  promoTitle: string;
  promoText: string;
  promoCtaLabel: string;
  promoCtaUrl: string;
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
    sections: { ratings: true, badges: true, related: true, trust: true, announcement: false, promo: false },
    headline: "",
    tagline: "",
    announcement: "",
    promoTitle: "",
    promoText: "",
    promoCtaLabel: "",
    promoCtaUrl: "",
  };
}

/** Merge a stored (possibly partial) config for a surface with defaults. */
export function resolveSurfaceConfig(raw: unknown, surface: Surface): SurfaceConfig {
  const base = defaultSurfaceConfig();
  const root = (raw ?? {}) as Record<string, unknown>;
  const s = (root[surface] ?? {}) as Partial<SurfaceConfig> & { sections?: Partial<SurfaceConfig["sections"]> };
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
    headline: typeof s.headline === "string" ? s.headline : "",
    tagline: typeof s.tagline === "string" ? s.tagline : "",
    announcement: typeof s.announcement === "string" ? s.announcement : "",
    promoTitle: typeof s.promoTitle === "string" ? s.promoTitle : "",
    promoText: typeof s.promoText === "string" ? s.promoText : "",
    promoCtaLabel: typeof s.promoCtaLabel === "string" ? s.promoCtaLabel : "",
    promoCtaUrl: typeof s.promoCtaUrl === "string" ? s.promoCtaUrl : "",
  };
}

/** CSS custom properties for a resolved config — spread onto the shell wrapper. */
export function themeCssVars(cfg: SurfaceConfig): Record<string, string> {
  const theme = STOREFRONT_THEMES[cfg.theme] ?? STOREFRONT_THEMES[DEFAULT_THEME];
  const accent = cfg.accent ?? theme.vars.accent;
  const fontKey = cfg.font ?? theme.defaultFont;
  const font = FONTS[fontKey];
  return {
    "--sf-bg": theme.vars.bg,
    "--sf-bg2": theme.vars.bg2,
    "--sf-surface": theme.vars.surface,
    "--sf-fg": theme.vars.fg,
    "--sf-muted": theme.vars.muted,
    "--sf-border": theme.vars.border,
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
