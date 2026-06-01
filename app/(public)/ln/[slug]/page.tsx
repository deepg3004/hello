// /ln/[slug] — landing / lead-magnet page. Renders the same component as
// /p/[slug] (slugs are unique); friendlier shareable prefix.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export { generateMetadata, default } from "@/app/(public)/p/[slug]/page";
