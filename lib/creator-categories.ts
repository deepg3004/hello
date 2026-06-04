// =============================================================================
// Creator categories — single source of truth for the seller's self-selected
// niche. Keys MUST match the CHECK constraint in migration 046_creator_category.
// Internal use only (onboarding personalisation + admin); not shown to buyers.
// =============================================================================

export const CREATOR_CATEGORIES = [
  { key: "finance", label: "Finance & Trading" },
  { key: "astrology", label: "Astrology / Numerology" },
  { key: "coaching", label: "Coaching" },
  { key: "digital_marketing", label: "Digital Marketing" },
  { key: "education", label: "Education & Career" },
  { key: "fitness", label: "Fitness & Nutrition" },
  { key: "design", label: "Design & Arts" },
  { key: "technology", label: "Technology & IT" },
  { key: "legal", label: "Law & Legal Services" },
  { key: "medical", label: "Medical & Health" },
  { key: "travel", label: "Travel / Hospitality" },
  { key: "beauty", label: "Beauty & Personal Care" },
  { key: "entertainment", label: "Entertainment & Media" },
  { key: "other", label: "Other" },
] as const;

export type CreatorCategory = (typeof CREATOR_CATEGORIES)[number]["key"];

export const CREATOR_CATEGORY_KEYS: readonly CreatorCategory[] =
  CREATOR_CATEGORIES.map((c) => c.key);

export function isCreatorCategory(value: string): value is CreatorCategory {
  return (CREATOR_CATEGORY_KEYS as readonly string[]).includes(value);
}

/** Human label for a stored key, or null if unset/unknown. */
export function creatorCategoryLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return CREATOR_CATEGORIES.find((c) => c.key === key)?.label ?? null;
}
