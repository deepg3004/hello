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
};

export const SITE_THEME_LIST = Object.values(SITE_THEMES);
export const DEFAULT_SITE_THEME = "midnight";

export function getSiteTheme(key?: string | null): SiteTheme {
  return SITE_THEMES[key ?? ""] ?? SITE_THEMES[DEFAULT_SITE_THEME]!;
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
