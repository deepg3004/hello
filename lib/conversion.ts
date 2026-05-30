// Shared types for the page-level Conversion widgets (countdown + exit intent).
// Stored on pages.page_config as { countdown_config, exit_intent_config }.

export type CountdownPosition = "sticky_top" | "above_cta" | "hidden";
export type CountdownExpiryBehavior = "hide" | "show_expired" | "redirect";

export interface CountdownConfig {
  enabled?: boolean;
  type?: "fixed" | "evergreen";
  /** ISO date for fixed timers. */
  target?: string;
  /** Duration in hours for evergreen timers. */
  duration_hours?: number;
  expiry_behavior?: CountdownExpiryBehavior;
  expiry_redirect_url?: string;
  expiry_text?: string;
  label?: string;
  bg_color?: string;
  text_color?: string;
  position?: CountdownPosition;
}

export type ExitIntentAction = "show_coupon" | "show_form" | "show_message";

export interface ExitIntentConfig {
  enabled?: boolean;
  action?: ExitIntentAction;
  /** For show_coupon. */
  coupon_code?: string;
  coupon_description?: string;
  /** For show_message. */
  headline?: string;
  body?: string;
  cta_text?: string;
  cta_url?: string;
  min_time_seconds?: number;
  suppress_hours?: number;
}

export const COUNTDOWN_DEFAULTS: Required<
  Pick<CountdownConfig, "type" | "label" | "bg_color" | "text_color" | "position" | "expiry_behavior" | "duration_hours">
> = {
  type: "fixed",
  label: "Offer ends in",
  bg_color: "#0a0a0a",
  text_color: "#ffffff",
  position: "sticky_top",
  expiry_behavior: "hide",
  duration_hours: 24,
};

export const EXIT_INTENT_DEFAULTS: Required<
  Pick<ExitIntentConfig, "action" | "headline" | "body" | "cta_text" | "min_time_seconds" | "suppress_hours">
> = {
  action: "show_message",
  headline: "Wait — before you go",
  body: "Get an exclusive offer if you sign up today.",
  cta_text: "Show me",
  min_time_seconds: 10,
  suppress_hours: 24,
};

export function resolvedCountdown(cfg?: CountdownConfig | null): CountdownConfig {
  return { ...COUNTDOWN_DEFAULTS, ...(cfg ?? {}) };
}

export function resolvedExitIntent(cfg?: ExitIntentConfig | null): ExitIntentConfig {
  return { ...EXIT_INTENT_DEFAULTS, ...(cfg ?? {}) };
}
