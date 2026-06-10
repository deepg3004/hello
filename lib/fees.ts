// =============================================================================
// Platform fee engine — pure, client-safe (no DB, no server-only imports so the
// admin fee form and seller pages can import the types + resolver).
//
// A fee rule = a fixed paise amount + a percent of order value. The effective
// per-order platform fee is resolved by precedence:
//   1. page-category rule (pages.fee_category, or built-in derived from type)
//   2. plan rule (seller's subscription_plan)
//   3. default rule
//   4. (caller falls back to PLANS[plan].wallet_fee_paise when this returns null)
//
// A rule with BOTH fixed_paise and percent at 0 is treated as "unset" so that,
// until an admin configures something, today's legacy per-plan fees still apply.
// =============================================================================

export interface FeeRule {
  fixed_paise: number;
  percent: number;
}

export interface FeeCategory {
  key: string;
  label: string;
  fixed_paise: number;
  percent: number;
}

export interface FeeConfig {
  default: FeeRule;
  byPlan: Record<string, FeeRule>;
  categories: FeeCategory[];
  /** GST % charged on the platform fee itself (the fee is a taxable service). */
  gstPercent: number;
}

/** Statutory GST on the platform fee. Admin-overridable via platform_settings. */
export const DEFAULT_GST_PERCENT = 18;

/** Built-in fee categories (seeded into the admin form when none are stored). */
export const BUILT_IN_FEE_CATEGORIES: FeeCategory[] = [
  { key: "payment", label: "Payment pages", fixed_paise: 0, percent: 0 },
  { key: "landing", label: "Landing pages", fixed_paise: 0, percent: 0 },
  { key: "leads", label: "Lead pages", fixed_paise: 0, percent: 0 },
  { key: "telegram", label: "Telegram pages", fixed_paise: 0, percent: 0 },
];

const TELEGRAM_TEMPLATES = new Set(["telegram-vip", "telegram_vip"]);

/** The fee category for a page — explicit override, else derived from its type. */
export function feeCategoryForPage(page: {
  type?: string | null;
  template_id?: string | null;
  fee_category?: string | null;
}): string {
  if (page.fee_category) return page.fee_category;
  if (page.template_id && TELEGRAM_TEMPLATES.has(page.template_id)) return "telegram";
  if (page.type === "landing") return "landing";
  if (page.type === "lead_magnet") return "leads";
  return "payment"; // payment + any unknown type
}

export function emptyRule(): FeeRule {
  return { fixed_paise: 0, percent: 0 };
}

function isSet(rule: FeeRule | undefined | null): rule is FeeRule {
  return (
    !!rule &&
    ((Number.isFinite(rule.fixed_paise) && rule.fixed_paise > 0) ||
      (Number.isFinite(rule.percent) && rule.percent > 0))
  );
}

function feeFromRule(rule: FeeRule, orderAmountPaise: number): number {
  const fixed = Number.isFinite(rule.fixed_paise) ? rule.fixed_paise : 0;
  const pct = Number.isFinite(rule.percent) ? rule.percent : 0;
  return Math.max(0, Math.round(fixed + (pct / 100) * orderAmountPaise));
}

/**
 * The fee RULE that applies to a plan for display (no order amount needed):
 * plan rule → default rule → legacy fixed fee. Used by seller dashboards to
 * show "₹X + Y% per order".
 */
export function effectivePlanRule(
  plan: string,
  cfg: FeeConfig | null,
  legacyFixedPaise: number,
): FeeRule {
  if (cfg) {
    const pr = cfg.byPlan[plan];
    if (isSet(pr)) return pr;
    if (isSet(cfg.default)) return cfg.default;
  }
  return { fixed_paise: legacyFixedPaise, percent: 0 };
}

/** "₹X + Y% per order" / "₹X per order" / "Y% per order" for a fee rule. */
export function describeFeeRule(rule: FeeRule, formatINR: (paise: number) => string): string {
  const parts: string[] = [];
  if (rule.fixed_paise > 0) parts.push(formatINR(rule.fixed_paise));
  if (rule.percent > 0) parts.push(`${rule.percent}%`);
  if (parts.length === 0) return "No fee";
  return `${parts.join(" + ")} per order`;
}

/**
 * Resolve the platform fee in paise, or null when nothing is configured (the
 * caller then falls back to the legacy per-plan PLANS value).
 */
export function resolvePlatformFeePaise(
  args: { plan: string; feeCategory: string | null; orderAmountPaise: number },
  cfg: FeeConfig | null,
): number | null {
  if (!cfg) return null;

  if (args.feeCategory) {
    const cat = cfg.categories.find((c) => c.key === args.feeCategory);
    if (cat && isSet(cat)) return feeFromRule(cat, args.orderAmountPaise);
  }
  const planRule = cfg.byPlan[args.plan];
  if (isSet(planRule)) return feeFromRule(planRule, args.orderAmountPaise);

  if (isSet(cfg.default)) return feeFromRule(cfg.default, args.orderAmountPaise);

  return null;
}

// ── GST on the platform fee ─────────────────────────────────────────────────
// The platform fee is a taxable service, so GST is added ON TOP of the fee and
// debited from the seller's wallet together with it. Example: ₹1,000 order, 3%
// fee = ₹30 fee + 18% GST (₹5.40) = ₹35.40 wallet debit.

/** Pick a usable GST percent from a (possibly null) config. */
export function gstPercentFromConfig(cfg: FeeConfig | null): number {
  const pct = cfg?.gstPercent;
  return Number.isFinite(pct) && (pct as number) >= 0
    ? (pct as number)
    : DEFAULT_GST_PERCENT;
}

/** GST amount (paise) charged on a platform fee. */
export function gstOnFeePaise(feePaise: number, gstPercent: number): number {
  const pct = Number.isFinite(gstPercent) && gstPercent > 0 ? gstPercent : 0;
  return Math.max(0, Math.round((pct / 100) * Math.max(0, feePaise)));
}

/** Total wallet debit for a platform fee = fee + GST-on-fee. */
export function grossFeePaise(feePaise: number, gstPercent: number): number {
  return Math.max(0, feePaise) + gstOnFeePaise(feePaise, gstPercent);
}
