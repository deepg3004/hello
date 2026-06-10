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
import {
  BUILT_IN_FEE_CATEGORIES,
  DEFAULT_GST_PERCENT,
  emptyRule,
  type FeeCategory,
  type FeeConfig,
  type FeeRule,
} from "@/lib/fees";

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

// Seller payouts removed (Session 2): InvoxAI holds no funds, so there is no
// payout minimum or chargeback-hold buffer. Sellers collect via their own
// gateway; the platform's only debit is the per-order wallet commission.

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

/**
 * When true, checkout (create-order) is blocked unless the seller's wallet can
 * cover the per-order platform fee. Admin-editable via `require_wallet_balance`;
 * defaults OFF so unfunded wallets don't break existing sellers.
 */
export async function getRequireWalletBalance(): Promise<boolean> {
  return (await getSetting("require_wallet_balance", "false")) === "true";
}

// ── Platform fee engine config (lib/fees.ts) ────────────────────────────────
function parseRule(raw: string): FeeRule {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const fixed = Number(o?.fixed_paise);
    const pct = Number(o?.percent);
    return {
      fixed_paise: Number.isFinite(fixed) && fixed > 0 ? Math.round(fixed) : 0,
      percent: Number.isFinite(pct) && pct > 0 ? pct : 0,
    };
  } catch {
    return emptyRule();
  }
}

/**
 * Admin-configurable platform fee rules (default / per-plan / per-category),
 * read from platform_settings. Pairs with lib/fees.resolvePlatformFeePaise().
 * Anything unset stays at zero so the legacy PLANS fee remains the fallback.
 */
export async function getFeeConfig(): Promise<FeeConfig> {
  const s = await getSettings({
    platform_fee_default: "",
    platform_fee_by_plan: "",
    platform_fee_categories: "",
    platform_fee_gst_percent: "",
  });

  const gstRaw = Number(s.platform_fee_gst_percent);
  const gstPercent =
    Number.isFinite(gstRaw) && gstRaw >= 0 ? gstRaw : DEFAULT_GST_PERCENT;

  const def = s.platform_fee_default ? parseRule(s.platform_fee_default) : emptyRule();

  const byPlan: Record<string, FeeRule> = {};
  if (s.platform_fee_by_plan) {
    try {
      const parsed = JSON.parse(s.platform_fee_by_plan) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed)) {
        byPlan[k] = parseRule(JSON.stringify(v));
      }
    } catch {
      /* malformed — leave empty */
    }
  }

  let categories: FeeCategory[] = BUILT_IN_FEE_CATEGORIES;
  if (s.platform_fee_categories) {
    try {
      const parsed = JSON.parse(s.platform_fee_categories) as unknown[];
      if (Array.isArray(parsed)) {
        categories = parsed
          .map((c) => {
            const o = c as Record<string, unknown>;
            const key = String(o?.key ?? "").trim();
            if (!key) return null;
            const r = parseRule(JSON.stringify(o));
            return {
              key,
              label: String(o?.label ?? key),
              fixed_paise: r.fixed_paise,
              percent: r.percent,
            } satisfies FeeCategory;
          })
          .filter((c): c is FeeCategory => c !== null);
        if (categories.length === 0) categories = BUILT_IN_FEE_CATEGORIES;
      }
    } catch {
      categories = BUILT_IN_FEE_CATEGORIES;
    }
  }

  return { default: def, byPlan, categories, gstPercent };
}
