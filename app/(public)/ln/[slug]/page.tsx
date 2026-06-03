// /ln/[slug] — landing page. Shares the /p renderer (slugs are unique); a page
// whose canonical prefix isn't /ln redirects to its correct URL.
import { renderPublicPage } from "@/app/(public)/p/[slug]/page";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export { generateMetadata } from "@/app/(public)/p/[slug]/page";

export default async function LandingPage(props: {
  params: { slug: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  return renderPublicPage(props.params, "ln", props.searchParams);
}
