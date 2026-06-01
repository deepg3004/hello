// =============================================================================
// Platform settings — the single read-path for admin-editable rows in the
// `platform_settings` table.
//
// Admin writes via `updateSettingAction` (actions/admin.ts). Everything that
// CONSUMES a setting (branding, payout minimum, …) must read it through this
// module so an admin change actually takes effect site-wide instead of hitting
// a hardcoded constant. Server-only (uses the service-role client).
// =============================================================================

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { MIN_PAYOUT_AMOUNT } from "@/lib/payouts/constants";

/** Read a single setting value, falling back when missing/unreadable. */
export async function getSetting(
  key: string,
  fallback = "",
): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .single<{ value: string | null }>();
    const v = data?.value;
    return v === null || v === undefined || v === "" ? fallback : v;
  } catch {
    return fallback;
  }
}

/** Read several settings in one round-trip. Missing keys use their fallback. */
export async function getSettings(
  defaults: Record<string, string>,
): Promise<Record<string, string>> {
  const out = { ...defaults };
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("key, value")
      .in("key", Object.keys(defaults));
    for (const row of (data ?? []) as Array<{ key: string; value: string | null }>) {
      if (row.value !== null && row.value !== undefined && row.value !== "") {
        out[row.key] = row.value;
      }
    }
  } catch {
    /* fall through to defaults */
  }
  return out;
}

export interface Branding {
  name: string;
  logoUrl: string;
}

/** Platform brand name + logo URL, used by the app chrome (sidebars, auth). */
export async function getBranding(): Promise<Branding> {
  const s = await getSettings({
    platform_name: "InvoxAI",
    platform_logo_url: "",
  });
  return { name: s.platform_name, logoUrl: s.platform_logo_url };
}

/**
 * The platform-wide minimum payout (rupees). Admin-editable via
 * `min_payout_amount`; falls back to the compiled-in default when unset or
 * invalid. Per-seller overrides (`payout_min_threshold`) are layered on top of
 * this in lib/payouts.requestPayout().
 */
export async function getMinPayoutAmount(): Promise<number> {
  const raw = await getSetting("min_payout_amount", "");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : MIN_PAYOUT_AMOUNT;
}
