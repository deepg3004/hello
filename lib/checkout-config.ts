// Page-level checkout config — shared by server (public page / preview, which
// build it) and the client CheckoutConfigProvider / CheckoutForm (which consume
// it). MUST stay a plain (non-"use client") module: a server component that
// imports a function from a "use client" file gets a client-reference proxy,
// not the real function ("... is not a function" at runtime).

export interface CheckoutConfig {
  payWhatYouLike?: {
    presets: Array<{ amount: number; label?: string; popular?: boolean }>;
    min?: number;
  };
  payLabel?: string;
}

/**
 * Build a CheckoutConfig from raw page_config values. Reads the same pwyl_*
 * keys the Pricing settings + the pwyl template write. Returns null when custom
 * pricing is off so fixed-price templates are unaffected.
 */
export function checkoutConfigFromValues(
  values: Record<string, unknown>,
): CheckoutConfig | null {
  if (values.pwyl_enabled !== true) return null;
  const rawPresets = Array.isArray(values.pwyl_presets)
    ? (values.pwyl_presets as Array<Record<string, unknown>>)
    : [];
  const presets = rawPresets
    .map((p) => ({
      amount: Number(p.amount),
      label: typeof p.label === "string" ? p.label : undefined,
      popular: !!p.popular,
    }))
    .filter((p) => Number.isFinite(p.amount) && p.amount > 0);
  const min =
    typeof values.pwyl_min === "number" && values.pwyl_min > 0
      ? values.pwyl_min
      : undefined;
  return { payWhatYouLike: { presets, min }, payLabel: "Make Payment" };
}
