// =============================================================================
// Social proof — pure helpers + shared types.
//
// Stored at page_config.social_proof_config — JSONB. Client + server share
// this file safely (no Node imports).
// =============================================================================

export type PopupPosition = "bottom-left" | "bottom-right";
export type CountType = "total" | "today" | "week";

export interface SocialProofConfig {
  popup_enabled?: boolean;
  /** Seconds between popups. */
  popup_delay_seconds?: number;
  /** Seconds each popup is visible. */
  popup_duration_seconds?: number;
  popup_position?: PopupPosition;

  badge_enabled?: boolean;
  badge_count_type?: CountType;
  /** Suffix shown after the number, e.g. "people bought this". */
  badge_label_text?: string;

  /** Seed entries the seller adds once for empty new pages. */
  seed_count?: number;
}

export const SOCIAL_PROOF_DEFAULTS: Required<
  Omit<SocialProofConfig, "seed_count">
> & { seed_count: number } = {
  popup_enabled: false,
  popup_delay_seconds: 25,
  popup_duration_seconds: 7,
  popup_position: "bottom-left",
  badge_enabled: false,
  badge_count_type: "total",
  badge_label_text: "people bought this",
  seed_count: 0,
};

export function resolveSocialProofConfig(
  raw: Partial<SocialProofConfig> | null | undefined,
): Required<Omit<SocialProofConfig, "seed_count">> & { seed_count: number } {
  const cfg = raw ?? {};
  return {
    popup_enabled: !!cfg.popup_enabled,
    popup_delay_seconds: clamp(
      Number(cfg.popup_delay_seconds ?? SOCIAL_PROOF_DEFAULTS.popup_delay_seconds),
      10,
      60,
    ),
    popup_duration_seconds: clamp(
      Number(
        cfg.popup_duration_seconds ?? SOCIAL_PROOF_DEFAULTS.popup_duration_seconds,
      ),
      5,
      10,
    ),
    popup_position:
      cfg.popup_position === "bottom-right"
        ? "bottom-right"
        : "bottom-left",
    badge_enabled: !!cfg.badge_enabled,
    badge_count_type:
      cfg.badge_count_type === "today"
        ? "today"
        : cfg.badge_count_type === "week"
          ? "week"
          : "total",
    badge_label_text:
      typeof cfg.badge_label_text === "string" && cfg.badge_label_text.trim()
        ? cfg.badge_label_text
        : SOCIAL_PROOF_DEFAULTS.badge_label_text,
    seed_count: clamp(
      Number(cfg.seed_count ?? SOCIAL_PROOF_DEFAULTS.seed_count),
      0,
      10,
    ),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

// ----------------------------------------------------------------------------
// Anonymisation
// ----------------------------------------------------------------------------

/**
 * "Riya Sharma" → "Riya S."
 * "MADHUKAR" → "Madhukar"  (single token)
 * undefined → "Someone"
 */
export function anonymiseName(full: string | null | undefined): string {
  if (!full) return "Someone";
  const parts = full
    .trim()
    .split(/\s+/)
    .filter((p) => /[A-Za-z]/.test(p));
  if (parts.length === 0) return "Someone";
  const first = capitalise(parts[0]!);
  if (parts.length === 1) return first;
  const lastInitial = parts[parts.length - 1]![0]!.toUpperCase();
  return `${first} ${lastInitial}.`;
}

function capitalise(word: string): string {
  if (!word) return word;
  return word[0]!.toUpperCase() + word.slice(1).toLowerCase();
}

/** "Mumbai, MH" → "Mumbai" — keep it short and friendly. */
export function shortCity(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = input.split(",")[0]?.trim();
  if (!cleaned) return null;
  return cleaned.length > 24 ? cleaned.slice(0, 24) : cleaned;
}

// ----------------------------------------------------------------------------
// Redis key helpers
// ----------------------------------------------------------------------------

export function spCountKey(pageId: string): string {
  return `sp_count_${pageId}`;
}
export function spCacheKey(pageId: string): string {
  return `sp_cache_${pageId}`;
}
export function spRateLimitKey(ip: string, pageId: string): string {
  return `sp_rl_${pageId}_${ip}`;
}

export const SP_CACHE_TTL_SECONDS = 30;
export const SP_RL_TTL_SECONDS = 30;
export const SP_MAX_EVENTS_KEPT = 20;
