// /ld/[slug] — lead-magnet (lead-capture) page. Shares the /p renderer (slugs
// are unique); a page whose canonical prefix isn't /ld redirects to its correct
// URL.
import { renderPublicPage } from "@/app/(public)/p/[slug]/page";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export { generateMetadata } from "@/app/(public)/p/[slug]/page";

export default async function LeadPage(props: {
  params: { slug: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  return renderPublicPage(props.params, "ld", props.searchParams);
}
