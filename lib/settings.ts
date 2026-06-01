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
import { MIN_PAYOUT_AMOUNT, CHARGEBACK_HOLD_DAYS } from "@/lib/payouts/constants";

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

/**
 * How many days a paid order is held before it becomes payable (chargeback
 * buffer). Admin-editable via `payout_hold_days`; falls back to the compiled
 * default. **0 is allowed** (release immediately) — only a missing/invalid
 * value falls back to the default.
 */
export async function getPayoutHoldDays(): Promise<number> {
  const raw = await getSetting("payout_hold_days", "");
  if (raw === "") return CHARGEBACK_HOLD_DAYS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : CHARGEBACK_HOLD_DAYS;
}

export interface CommissionConfig {
  /** Platform default commission %, used when a plan has no override. */
  defaultPercent: number;
  /** Admin per-plan absolute-percent overrides, or null when unset/invalid. */
  perPlan: Record<string, number> | null;
}

/**
 * Resolve the commission knobs an order-creation route needs: the platform
 * default (`platform_commission_percent`, falling back to the env var then 5)
 * and the per-plan override map (`commission_per_plan`, a JSON object of
 * planKey → absolute percent). Pair with lib/plans.resolveCommissionPercent().
 */
export async function getCommissionConfig(): Promise<CommissionConfig> {
  const s = await getSettings({
    platform_commission_percent: "",
    commission_per_plan: "",
  });

  const dbDefault = Number(s.platform_commission_percent);
  const defaultPercent =
    Number.isFinite(dbDefault) && dbDefault >= 0
      ? dbDefault
      : Number(process.env.PLATFORM_COMMISSION_PERCENT ?? 5);

  let perPlan: Record<string, number> | null = null;
  if (s.commission_per_plan) {
    try {
      const parsed = JSON.parse(s.commission_per_plan) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const map: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed)) {
          const n = Number(v);
          if (Number.isFinite(n)) map[k] = n;
        }
        if (Object.keys(map).length > 0) perPlan = map;
      }
    } catch {
      perPlan = null; // malformed JSON — fall back to compiled discounts
    }
  }

  return { defaultPercent, perPlan };
}
