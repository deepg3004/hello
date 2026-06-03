// =============================================================================
// Page-category dashboards. The Pages area is split into dedicated routes —
// one per kind of page — each rendered by the same <PagesDashboard> component
// parameterised by this config:
//
//   /dashboard/pages            → All
//   /dashboard/pages/payment    → Payment pages
//   /dashboard/pages/landing    → Landing pages
//   /dashboard/pages/leads      → Lead-magnet pages
//   /dashboard/pages/telegram   → Telegram VIP pages
//
// Telegram VIP pages live in the DB as type='payment' on the telegram-vip
// template, so they're recognised by template_id, not the type column.
// =============================================================================

export type PageCategoryKey =
  | "all"
  | "payment"
  | "landing"
  | "leads"
  | "telegram";

const TELEGRAM_TEMPLATES = new Set(["telegram-vip", "telegram_vip"]);

export interface PageCategoryConfig {
  key: PageCategoryKey;
  /** Display name in the hero + nav. */
  label: string;
  /** One-line description under the hero title. */
  blurb: string;
  /** Dashboard route. */
  route: string;
  /** Pre-selected page type for the "+ Create" deep-link (omitted for "all"). */
  createType?: "payment" | "landing" | "lead_magnet";
  /** Pre-selected template for the wizard (Telegram jumps straight in). */
  createTemplate?: string;
  /** Tailwind gradient classes for the hero banner. */
  heroGradient: string;
}

export const PAGE_CATEGORIES: Record<PageCategoryKey, PageCategoryConfig> = {
  all: {
    key: "all",
    label: "All Pages",
    blurb: "Every payment, landing, lead and Telegram page in one place.",
    route: "/dashboard/pages",
    heroGradient: "from-indigo-600 via-violet-600 to-fuchsia-600",
  },
  payment: {
    key: "payment",
    label: "Payment Pages",
    blurb: "Sell products and services with a checkout that converts.",
    route: "/dashboard/pages/payment",
    createType: "payment",
    heroGradient: "from-indigo-600 via-blue-600 to-cyan-600",
  },
  landing: {
    key: "landing",
    label: "Landing Pages",
    blurb: "Promote an offer, webinar or launch with a high-impact page.",
    route: "/dashboard/pages/landing",
    createType: "landing",
    heroGradient: "from-emerald-600 via-teal-600 to-green-600",
  },
  leads: {
    key: "leads",
    label: "Lead Pages",
    blurb: "Capture emails and grow your audience with a free lead magnet.",
    route: "/dashboard/pages/leads",
    createType: "lead_magnet",
    heroGradient: "from-amber-500 via-orange-500 to-rose-500",
  },
  telegram: {
    key: "telegram",
    label: "Telegram Pages",
    blurb: "Monetise a private Telegram channel with paid memberships.",
    route: "/dashboard/pages/telegram",
    createType: "payment",
    createTemplate: "telegram-vip",
    heroGradient: "from-sky-600 via-indigo-600 to-violet-600",
  },
};

/** Ordered list for the category nav bar. Telegram is intentionally excluded —
 *  it lives under its own "Telegram" menu (/dashboard/telegram), not the Pages
 *  tabs. */
export const PAGE_CATEGORY_NAV: PageCategoryConfig[] = [
  PAGE_CATEGORIES.payment,
  PAGE_CATEGORIES.landing,
  PAGE_CATEGORIES.leads,
];

/** Does a page belong to the given category? */
export function pageMatchesCategory(
  page: { type: string; template_id: string | null },
  key: PageCategoryKey,
): boolean {
  const isTelegram = !!page.template_id && TELEGRAM_TEMPLATES.has(page.template_id);
  switch (key) {
    case "all":
      return true;
    case "telegram":
      return isTelegram;
    case "payment":
      return page.type === "payment" && !isTelegram;
    case "landing":
      return page.type === "landing";
    case "leads":
      return page.type === "lead_magnet";
  }
}

/** "+ Create" deep-link for a category (scopes the wizard to that kind). */
export function createPageHref(cfg: PageCategoryConfig): string {
  if (!cfg.createType) return "/dashboard/pages/new";
  const params = new URLSearchParams({ type: cfg.createType });
  if (cfg.createTemplate) params.set("template", cfg.createTemplate);
  return `/dashboard/pages/new?${params.toString()}`;
}
