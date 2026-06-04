// Which creator niches each template best fits. Used to surface relevant
// templates first in the builder. Kept as a central map so we don't edit all 20
// template definition files. A template not listed (or with []) is "neutral" —
// shown to everyone but never specially recommended.

import type { CreatorCategory } from "@/lib/creator-categories";

export const TEMPLATE_CREATOR_CATEGORIES: Record<string, CreatorCategory[]> = {
  // payment
  course: ["education", "coaching", "finance", "digital_marketing", "fitness", "astrology"],
  coaching: ["coaching", "fitness", "astrology", "finance", "education"],
  membership: ["coaching", "fitness", "finance", "entertainment", "education"],
  ebook: ["education", "finance", "astrology", "legal", "medical", "coaching"],
  service: ["design", "legal", "medical", "beauty", "technology", "digital_marketing"],
  "digital-product": ["design", "technology", "digital_marketing", "education"],
  bundle: ["education", "coaching", "digital_marketing"],
  pwyl: ["entertainment", "design", "other"],
  // landing
  webinar: ["coaching", "finance", "education", "digital_marketing"],
  "product-launch": ["technology", "design", "digital_marketing", "beauty"],
  "sales-promo": ["beauty", "fitness", "travel", "entertainment", "digital_marketing"],
  saas: ["technology", "digital_marketing"],
  "app-download": ["technology", "fitness", "entertainment"],
  newsletter: ["finance", "education", "entertainment", "other"],
  checklist: ["fitness", "finance", "education", "coaching"],
  waitlist: ["technology", "beauty", "design"],
  casestudy: ["digital_marketing", "legal", "medical", "technology"],
  freebie: ["coaching", "fitness", "finance", "education", "digital_marketing"],
  // telegram / custom
  "telegram-vip": ["finance", "astrology", "entertainment", "coaching"],
  custom: [],
};

/** True if a template is a good fit for the given creator category. */
export function templateMatchesCreator(
  templateId: string,
  category: string | null | undefined,
): boolean {
  if (!category) return false;
  return (TEMPLATE_CREATOR_CATEGORIES[templateId] ?? []).includes(
    category as CreatorCategory,
  );
}
