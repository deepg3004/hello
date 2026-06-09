// Theme palettes for the seller website builder. Blocks render against CSS
// variables (--s-fg / --s-fg-muted / --s-fg-dim / --s-surface / --s-border) set
// by the page wrapper, so one set of block components works in light AND dark.

import type { CSSProperties } from "react";

export interface SiteTheme {
  key: string;
  label: string;
  dark: boolean;
  bg: string;
  fg: string;
  fgMuted: string;
  fgDim: string;
  surface: string;
  border: string;
  accent: string;
}

export const SITE_THEMES: Record<string, SiteTheme> = {
  midnight: {
    key: "midnight", label: "Midnight", dark: true,
    bg: "#0b0b14", fg: "#ffffff", fgMuted: "#d4d4d8", fgDim: "#a1a1aa",
    surface: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)", accent: "#6366f1",
  },
  ocean: {
    key: "ocean", label: "Ocean", dark: true,
    bg: "#08131f", fg: "#ffffff", fgMuted: "#cbd5e1", fgDim: "#94a3b8",
    surface: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)", accent: "#38bdf8",
  },
  forest: {
    key: "forest", label: "Forest", dark: true,
    bg: "#0a1711", fg: "#ffffff", fgMuted: "#d1d5db", fgDim: "#9ca3af",
    surface: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)", accent: "#34d399",
  },
  plum: {
    key: "plum", label: "Plum", dark: true,
    bg: "#150b1b", fg: "#ffffff", fgMuted: "#e4d4ea", fgDim: "#b8a3c0",
    surface: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.10)", accent: "#c084fc",
  },
  light: {
    key: "light", label: "Light", dark: false,
    bg: "#f8fafc", fg: "#0f172a", fgMuted: "#334155", fgDim: "#64748b",
    surface: "#ffffff", border: "rgba(15,23,42,0.08)", accent: "#4f46e5",
  },
  sand: {
    key: "sand", label: "Sand", dark: false,
    bg: "#faf6f0", fg: "#1c1917", fgMuted: "#44403c", fgDim: "#78716c",
    surface: "#ffffff", border: "rgba(28,25,23,0.10)", accent: "#b45309",
  },
  // ── New palettes ──────────────────────────────────────────────────────────
  "noir-gold": {
    key: "noir-gold", label: "Noir Gold", dark: true,
    bg: "#0a0a0a", fg: "#fafafa", fgMuted: "#d4d4d4", fgDim: "#a3a3a3",
    surface: "rgba(255,255,255,0.05)", border: "rgba(212,175,55,0.20)", accent: "#d4af37",
  },
  royal: {
    key: "royal", label: "Royal", dark: true,
    bg: "#0c1024", fg: "#ffffff", fgMuted: "#cdd3f0", fgDim: "#9aa3d4",
    surface: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.10)", accent: "#818cf8",
  },
  sunset: {
    key: "sunset", label: "Sunset", dark: true,
    bg: "#1a0e0a", fg: "#fff7ed", fgMuted: "#fed7aa", fgDim: "#fdba74",
    surface: "rgba(255,255,255,0.05)", border: "rgba(251,146,60,0.20)", accent: "#fb7185",
  },
  carbon: {
    key: "carbon", label: "Carbon", dark: true,
    bg: "#0d1117", fg: "#e6edf3", fgMuted: "#c9d1d9", fgDim: "#8b949e",
    surface: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", accent: "#22d3ee",
  },
  aurora: {
    key: "aurora", label: "Aurora", dark: true,
    bg: "#0b1020", fg: "#f0f9ff", fgMuted: "#c7d2fe", fgDim: "#a5b4fc",
    surface: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.10)", accent: "#2dd4bf",
  },
  mocha: {
    key: "mocha", label: "Mocha", dark: true,
    bg: "#1c1410", fg: "#faf3ec", fgMuted: "#e7d8c9", fgDim: "#c0a892",
    surface: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.10)", accent: "#d6a25e",
  },
  rose: {
    key: "rose", label: "Rose", dark: false,
    bg: "#fff5f7", fg: "#3f1d2b", fgMuted: "#7c3a52", fgDim: "#a85878",
    surface: "#ffffff", border: "rgba(190,24,93,0.12)", accent: "#e11d48",
  },
  sky: {
    key: "sky", label: "Sky", dark: false,
    bg: "#f0f7ff", fg: "#0c1f3a", fgMuted: "#334e68", fgDim: "#5a7896",
    surface: "#ffffff", border: "rgba(12,31,58,0.08)", accent: "#0284c7",
  },
  mint: {
    key: "mint", label: "Mint", dark: false,
    bg: "#f1faf6", fg: "#0f2e23", fgMuted: "#2f5d4d", fgDim: "#5a8475",
    surface: "#ffffff", border: "rgba(15,46,35,0.08)", accent: "#059669",
  },
  cream: {
    key: "cream", label: "Cream", dark: false,
    bg: "#fdfbf6", fg: "#292524", fgMuted: "#57534e", fgDim: "#857f7a",
    surface: "#ffffff", border: "rgba(41,37,36,0.08)", accent: "#7c3aed",
  },
};

export const SITE_THEME_LIST = Object.values(SITE_THEMES);
export const DEFAULT_SITE_THEME = "midnight";

export function getSiteTheme(key?: string | null): SiteTheme {
  return SITE_THEMES[key ?? ""] ?? SITE_THEMES[DEFAULT_SITE_THEME]!;
}

// ── Fonts ───────────────────────────────────────────────────────────────────
export const SITE_FONTS: Array<{ key: string; label: string; stack: string }> = [
  { key: "sans", label: "Sans (default)", stack: "" },
  { key: "serif", label: "Serif", stack: 'Georgia, Cambria, "Times New Roman", serif' },
  {
    key: "rounded",
    label: "Rounded",
    stack: 'ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif',
  },
  { key: "mono", label: "Mono", stack: 'ui-monospace, "SFMono-Regular", Menlo, monospace' },
];

export function siteFontStack(key?: string | null): string | undefined {
  return SITE_FONTS.find((f) => f.key === key)?.stack || undefined;
}

/** Background style for a per-section appearance choice (data._bg). */
export function sectionBgStyle(
  bg: unknown,
  accent: string,
): CSSProperties | undefined {
  if (bg === "subtle") return { background: "var(--s-surface)" };
  if (bg === "accent") return { background: `${accent}14` };
  return undefined;
}

/** Inline style setting the block CSS variables + page background. `accent`
 *  (e.g. the seller's brand colour) overrides the theme accent when provided. */
export function siteThemeStyle(
  theme: SiteTheme,
  accent?: string | null,
): CSSProperties {
  return {
    background: theme.bg,
    color: theme.fg,
    ["--s-fg" as string]: theme.fg,
    ["--s-fg-muted" as string]: theme.fgMuted,
    ["--s-fg-dim" as string]: theme.fgDim,
    ["--s-surface" as string]: theme.surface,
    ["--s-border" as string]: theme.border,
    ["--s-accent" as string]: accent || theme.accent,
  } as CSSProperties;
}
