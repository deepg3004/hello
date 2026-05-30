// Shared prop types for the polished buyer-facing template components.

import type { FormConfig } from "@/lib/leads";
import type { OrderBumpConfig as PageBumpConfig } from "@/lib/upsells";

export interface TemplateProduct {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  currency: string;
}

export interface ThemeConfig {
  primary?: string;
  bgFrom?: string;
  bgTo?: string;
  heroText?: string;
  mode?: "light" | "dark";
}

export interface TimerConfig {
  enabled?: boolean;
  target?: string;
  label?: string;
}

/**
 * Legacy per-template bump (course "bump_*" fields). Templates that read these
 * directly from page_config values still work; the new page-level bump under
 * page_config.order_bump takes precedence via `bumpRuntime` below.
 */
export interface OrderBumpConfig {
  enabled?: boolean;
  title?: string;
  description?: string;
  price?: number;
}

/** Page-level order bump resolved at request time and ready for CheckoutForm. */
export type BumpRuntime = (PageBumpConfig & { ready: true }) | null;

export interface BaseTemplateProps {
  pageId?: string;
  product?: TemplateProduct | null;
  isPreview?: boolean;
  theme?: ThemeConfig;
  timer?: TimerConfig;
  orderBump?: OrderBumpConfig;
  /** Page-level bump from /dashboard/pages/[id]/edit → Conversion tab. */
  bumpRuntime?: BumpRuntime;
  socialProofEnabled?: boolean;
  formConfig?: FormConfig;
}

export const DEFAULT_THEME: Required<ThemeConfig> = {
  primary: "#0a0a0a",
  bgFrom: "#111827",
  bgTo: "#1f2937",
  heroText: "#ffffff",
  mode: "dark",
};
