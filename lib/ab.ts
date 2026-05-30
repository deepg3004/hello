// =============================================================================
// A/B testing — pure helpers (deterministic variant assignment + stats).
//
// Safe to import on the client OR from middleware (Edge runtime). No I/O.
// =============================================================================

export type Variant = "A" | "B";

export const VISITOR_COOKIE = "invoxai_visitor";
export const VISITOR_COOKIE_TTL_DAYS = 365;
export const VARIANT_COOKIE_TTL_DAYS = 30;

/** Cookie name used to remember the visitor's variant assignment per slug. */
export function variantCookieName(slug: string): string {
  // Cookie names are case-sensitive but slugs already lowercase by convention.
  // Sanitize anyway so unexpected chars (e.g. unicode) can't break headers.
  return `exp_${slug.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

// ---------------------------------------------------------------------------
// Deterministic visitor → variant hash (Edge-safe; no Node crypto needed)
// ---------------------------------------------------------------------------

/**
 * Pure 32-bit FNV-1a hash. Stable across JS engines, fast, no deps. Good
 * enough for traffic bucketing — we're not running a security primitive.
 */
export function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // 32-bit mul: equivalent of (h * 0x01000193) >>> 0 with manual carry to
    // avoid the precision loss with the 0x01000193 prime in 53-bit floats.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/**
 * Decide a variant for a visitor.
 *   trafficSplit = % of traffic that should land on A (0–100).
 */
export function allocateVariant(args: {
  visitorId: string;
  slug: string;
  trafficSplit: number;
}): Variant {
  const bucket = fnv1a32(`${args.slug}|${args.visitorId}`) % 100;
  return bucket < args.trafficSplit ? "A" : "B";
}

/**
 * 32-byte URL-safe random visitor id, Edge-runtime friendly. Uses Web Crypto
 * which is available everywhere Next.js middleware runs.
 */
export function newVisitorId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i]!.toString(16).padStart(2, "0");
  }
  return s;
}

// ---------------------------------------------------------------------------
// Stats — two-proportion z-test + normal CDF via Abramowitz & Stegun
// ---------------------------------------------------------------------------

/**
 * Complementary error function (erfc) — Abramowitz & Stegun 7.1.26.
 * Max error ~1.5e-7 — plenty for displaying a 95%-confidence badge.
 */
export function erfc(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  // erfc(-x) = 2 - erfc(x); 1 - erf(x) = erfc(x)
  return sign < 0 ? 2 - (1 - y) : 1 - y;
}

/** Standard normal CDF. */
export function normalCdf(z: number): number {
  return 1 - 0.5 * erfc(z / Math.SQRT2);
}

export interface ExperimentStats {
  visitors_a: number;
  visitors_b: number;
  conversions_a: number;
  conversions_b: number;
  cr_a: number;
  cr_b: number;
  z: number;
  /** P(real lift) ≈ confidence that the better variant truly wins. */
  confidence: number;
  /** Direction of the observed lift (B over A). */
  lift: number;
  /** "A" | "B" | null when not enough evidence. */
  winner: Variant | null;
  /** Sample size on the smaller arm. */
  min_arm_samples: number;
  /** True once gating thresholds are met (≥100 / arm AND confidence ≥ 0.95). */
  significant: boolean;
}

/** Minimum visitors per arm before we declare a winner. */
export const MIN_PER_ARM = 100;
/** Confidence threshold to flip the winner badge on. */
export const CONFIDENCE_THRESHOLD = 0.95;

export function computeExperimentStats(input: {
  visitors_a: number;
  visitors_b: number;
  conversions_a: number;
  conversions_b: number;
}): ExperimentStats {
  const visitors_a = Math.max(0, input.visitors_a);
  const visitors_b = Math.max(0, input.visitors_b);
  const conversions_a = Math.max(0, input.conversions_a);
  const conversions_b = Math.max(0, input.conversions_b);

  const cr_a = visitors_a > 0 ? conversions_a / visitors_a : 0;
  const cr_b = visitors_b > 0 ? conversions_b / visitors_b : 0;

  let z = 0;
  if (visitors_a > 0 && visitors_b > 0) {
    const pooled = (conversions_a + conversions_b) / (visitors_a + visitors_b);
    const denom = Math.sqrt(
      pooled * (1 - pooled) * (1 / visitors_a + 1 / visitors_b),
    );
    z = denom > 0 ? (cr_a - cr_b) / denom : 0;
  }

  // P(|Z| < |z|) — two-sided confidence that the lift is real.
  const confidence = 2 * normalCdf(Math.abs(z)) - 1;
  const min_arm_samples = Math.min(visitors_a, visitors_b);
  const sufficientSamples = min_arm_samples >= MIN_PER_ARM;
  const sufficientEvidence = confidence >= CONFIDENCE_THRESHOLD;

  let winner: Variant | null = null;
  if (sufficientSamples && sufficientEvidence) {
    winner = cr_a > cr_b ? "A" : "B";
  }

  return {
    visitors_a,
    visitors_b,
    conversions_a,
    conversions_b,
    cr_a,
    cr_b,
    z,
    confidence,
    lift: cr_a > 0 ? (cr_b - cr_a) / cr_a : 0,
    winner,
    min_arm_samples,
    significant: !!winner,
  };
}

// ---------------------------------------------------------------------------
// Redis key helpers
// ---------------------------------------------------------------------------

export function expConfigKey(slug: string): string {
  return `exp:${slug}`;
}
export function visitorsKey(slug: string, variant: Variant): string {
  return `exp:${slug}:${variant}:visitors`;
}
export function conversionsKey(slug: string, variant: Variant): string {
  return `exp:${slug}:${variant}:conversions`;
}
export function revenueKey(slug: string, variant: Variant): string {
  return `exp:${slug}:${variant}:revenue_paise`;
}
