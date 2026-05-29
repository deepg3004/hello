// Shared prop types for the polished buyer-facing template components.

import type { FormConfig } from "@/lib/leads";

export interface TemplateProduct {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  currency: string;
}

export interface ThemeConfig {
  /** Hex colour for buttons / accents. */
  primary?: string;
  /** Hex colour for the hero background gradient start. */
  bgFrom?: string;
  /** Hex colour for the hero background gradient end. */
  bgTo?: string;
  /** Text colour for the hero section. */
  heroText?: string;
  /** Light or dark — affects body text + card surfaces. */
  mode?: "light" | "dark";
}

export interface TimerConfig {
  enabled?: boolean;
  /** ISO 8601 — clock counts down to this instant. */
  target?: string;
  label?: string;
}

export interface OrderBumpConfig {
  enabled?: boolean;
  title?: string;
  description?: string;
  price?: number;
}

export interface BaseTemplateProps {
  pageId?: string;
  product?: TemplateProduct | null;
  isPreview?: boolean;
  theme?: ThemeConfig;
  timer?: TimerConfig;
  orderBump?: OrderBumpConfig;
  socialProofEnabled?: boolean;
  /** Form Builder config from page_config.form_config. */
  formConfig?: FormConfig;
}

export const DEFAULT_THEME: Required<ThemeConfig> = {
  primary: "#0a0a0a",
  bgFrom: "#111827",
  bgTo: "#1f2937",
  heroText: "#ffffff",
  mode: "dark",
};
