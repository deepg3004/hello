// =============================================================================
// Section categories — buckets each builder section into one of three tabs
// (Payment / Landing / Leads) so the customiser sidebar is easier to scan.
//
// A section can opt in explicitly via `section.category`; otherwise we fall
// back to a mapping keyed off its free-form `type` (hero, checkout, optin…).
// =============================================================================

import type { SectionCategory, TemplateSection } from "./types";

/** Display order + label for the three section tabs. */
export const SECTION_CATEGORY_META: Record<
  SectionCategory,
  { label: string; order: number }
> = {
  landing: { label: "Landing", order: 0 },
  payment: { label: "Payment", order: 1 },
  leads: { label: "Leads", order: 2 },
};

// Section `type` → category. Anything not listed here is treated as a
// marketing/content section and lands under "landing".
const TYPE_TO_CATEGORY: Record<string, SectionCategory> = {
  // Payment — checkout, pricing, conversion
  checkout: "payment",
  price_card: "payment",
  join: "payment",
  advanced: "payment",
  urgency: "payment",
  // Leads — capture forms
  register: "leads",
  optin: "leads",
  form: "leads",
  lead: "leads",
};

/** Resolve a section's tab: explicit `category` wins, else map from `type`. */
export function sectionCategory(section: TemplateSection): SectionCategory {
  return section.category ?? TYPE_TO_CATEGORY[section.type] ?? "landing";
}

export interface SectionGroup {
  category: SectionCategory;
  label: string;
  sections: TemplateSection[];
}

/**
 * Bucket sections into the three categories, in display order, dropping any
 * category with no sections. Within a category the original template order is
 * preserved.
 */
export function groupSectionsByCategory(
  sections: TemplateSection[],
): SectionGroup[] {
  const byCat = new Map<SectionCategory, TemplateSection[]>();
  for (const section of sections) {
    const cat = sectionCategory(section);
    const bucket = byCat.get(cat) ?? [];
    bucket.push(section);
    byCat.set(cat, bucket);
  }

  return (Object.keys(SECTION_CATEGORY_META) as SectionCategory[])
    .filter((cat) => byCat.has(cat))
    .sort(
      (a, b) => SECTION_CATEGORY_META[a].order - SECTION_CATEGORY_META[b].order,
    )
    .map((cat) => ({
      category: cat,
      label: SECTION_CATEGORY_META[cat].label,
      sections: byCat.get(cat)!,
    }));
}
