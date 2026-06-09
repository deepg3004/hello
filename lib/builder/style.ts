// Per-device style model for the builder. Each widget carries a ResponsiveStyle
// = { desktop?, tablet?, mobile? }. Tablet/mobile INHERIT desktop and override
// only what's set, so a seller styles desktop once and tweaks per device.
//
// resolveStyle() merges for a device; toCss() turns it into inline CSS for the
// editor preview. (The public renderer in a later phase emits media-query CSS
// from the same model so real visitors get the right per-device values.)

import type { CSSProperties } from "react";

import type { Device } from "@/lib/builder/types";

export interface StyleProps {
  color?: string;
  background?: string;
  fontSize?: number;
  fontWeight?: string;
  paddingY?: number;
  paddingX?: number;
  marginY?: number;
  marginX?: number;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  shadow?: "none" | "sm" | "md" | "lg" | "xl";
  /** Hide the widget on this device. */
  hidden?: boolean;
}

export type ResponsiveStyle = Partial<Record<Device, StyleProps>>;

export const SHADOWS: Record<NonNullable<StyleProps["shadow"]>, string> = {
  none: "none",
  sm: "0 1px 2px rgba(0,0,0,0.08)",
  md: "0 4px 14px rgba(0,0,0,0.10)",
  lg: "0 12px 32px rgba(0,0,0,0.14)",
  xl: "0 24px 60px rgba(0,0,0,0.20)",
};

/** Merge desktop base with the per-device overrides for `device`. */
export function resolveStyle(style: ResponsiveStyle | undefined, device: Device): StyleProps {
  const base = style?.desktop ?? {};
  if (device === "desktop") return base;
  return { ...base, ...(style?.[device] ?? {}) };
}

/** StyleProps → inline CSS (editor preview + eventual public base styles). */
export function toCss(p: StyleProps): CSSProperties {
  const css: CSSProperties = {};
  if (p.color) css.color = p.color;
  if (p.background) css.background = p.background;
  if (p.fontSize) css.fontSize = `${p.fontSize}px`;
  if (p.fontWeight) css.fontWeight = p.fontWeight as CSSProperties["fontWeight"];
  if (p.paddingY != null || p.paddingX != null)
    css.padding = `${p.paddingY ?? 0}px ${p.paddingX ?? 0}px`;
  if (p.marginY != null || p.marginX != null)
    css.margin = `${p.marginY ?? 0}px ${p.marginX ?? 0}px`;
  if (p.borderWidth) {
    css.borderStyle = "solid";
    css.borderWidth = `${p.borderWidth}px`;
    css.borderColor = p.borderColor ?? "#e5e7eb";
  }
  if (p.borderRadius != null) css.borderRadius = `${p.borderRadius}px`;
  if (p.shadow && p.shadow !== "none") css.boxShadow = SHADOWS[p.shadow];
  return css;
}

// ── Entrance animations (framer-motion presets) ───────────────────────────────
export const ANIMATIONS: Record<
  string,
  { initial: Record<string, number>; animate: Record<string, number> }
> = {
  none: { initial: {}, animate: {} },
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  "fade-up": { initial: { opacity: 0, y: 28 }, animate: { opacity: 1, y: 0 } },
  "fade-down": { initial: { opacity: 0, y: -28 }, animate: { opacity: 1, y: 0 } },
  zoom: { initial: { opacity: 0, scale: 0.92 }, animate: { opacity: 1, scale: 1 } },
  "slide-left": { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 } },
  "slide-right": { initial: { opacity: 0, x: -40 }, animate: { opacity: 1, x: 0 } },
};

export const ANIMATION_OPTIONS = Object.keys(ANIMATIONS);
