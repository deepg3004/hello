// Public page URL prefixes by page kind:
//   /p  — payment pages
//   /tg — Telegram VIP pages (a payment page on the telegram-vip template)
//   /ln — landing / lead-magnet pages
//
// All three resolve to the same renderer (slugs are unique); the prefix is a
// human-readable, shareable categorisation. /p is kept working for every page
// so existing links never break.

export type PagePrefix = "p" | "tg" | "ln";

const TELEGRAM_TEMPLATES = new Set(["telegram-vip", "telegram_vip"]);

export function pagePrefix(
  type: string | null | undefined,
  templateId?: string | null,
): PagePrefix {
  if (templateId && TELEGRAM_TEMPLATES.has(templateId)) return "tg";
  if (type === "landing" || type === "lead_magnet") return "ln";
  return "p";
}

/** Path like "/tg/my-channel" for a page. */
export function publicPagePath(
  type: string | null | undefined,
  slug: string,
  templateId?: string | null,
): string {
  return `/${pagePrefix(type, templateId)}/${slug}`;
}

/** Absolute URL using NEXT_PUBLIC_APP_URL (falls back to app.invoxai.io). */
export function publicPageUrl(
  type: string | null | undefined,
  slug: string,
  templateId?: string | null,
): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
  return `${base}${publicPagePath(type, slug, templateId)}`;
}
