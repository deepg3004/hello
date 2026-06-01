// /tg/[slug] — Telegram VIP page. Renders the exact same component as
// /p/[slug] (slugs are unique); this is just a friendlier shareable prefix.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export { generateMetadata, default } from "@/app/(public)/p/[slug]/page";
