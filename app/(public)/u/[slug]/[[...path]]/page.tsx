// Public builder site: /u/<slug> (home) and /u/<slug>/<path> (sub-page).
// Renders the published page with header/footer/background/bottom-bar/chat.

import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { PublicSite } from "@/components/builder/PublicSite";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string; path?: string[] };
}

export async function generateMetadata({ params }: Props) {
  const admin = createAdminClient();
  const { data: site } = await admin
    .from("builder_sites")
    .select("title, is_published")
    .eq("slug", params.slug)
    .maybeSingle();
  return { title: site?.title ?? "Site" };
}

export default async function PublicBuilderPage({ params }: Props) {
  const path = (params.path ?? []).join("/");
  const admin = createAdminClient();

  const { data: site } = await admin
    .from("builder_sites")
    .select("id, title, is_published, header_json, footer_json, contacts_json")
    .eq("slug", params.slug)
    .maybeSingle();
  // Only published sites are publicly visible.
  if (!site || !site.is_published) notFound();

  // Resolve the page by path; fall back to the first page (home).
  let { data: page } = await admin
    .from("builder_pages")
    .select("content_json, page_type, background_style, bottombar_json")
    .eq("site_id", site.id)
    .eq("path", path)
    .maybeSingle();
  if (!page) {
    const { data: pages } = await admin
      .from("builder_pages")
      .select("content_json, page_type, background_style, bottombar_json")
      .eq("site_id", site.id)
      .order("sort_order", { ascending: true })
      .limit(1);
    page = pages?.[0] ?? null;
  }
  if (!page) notFound();

  return <PublicSite site={site} page={page} />;
}
