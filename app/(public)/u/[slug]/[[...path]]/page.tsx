// Public builder site: /u/<slug> (home) and /u/<slug>/<path> (sub-page).
// Renders the published page with header/footer/background/bottom-bar/chat.

import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { PublicSite } from "@/components/builder/PublicSite";
import { PagePasswordGate } from "@/components/builder/PagePasswordGate";
import { TrackingProvider } from "@/components/tracking/TrackingProvider";
import { loadMarketing } from "@/lib/marketing";
import { isUnlocked, unlockCookieName } from "@/lib/builder-unlock";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string; path?: string[] };
}

export async function generateMetadata({ params }: Props) {
  const admin = createAdminClient();
  const { data: site } = await admin
    .from("builder_sites")
    .select("id, title, is_published")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!site) return { title: "Site" };

  // Resolve the same page the component renders (path, else home) for its SEO.
  const path = (params.path ?? []).join("/");
  let { data: pg } = await admin
    .from("builder_pages")
    .select("name, seo_title, seo_description, og_image, noindex")
    .eq("site_id", site.id)
    .eq("path", path)
    .maybeSingle();
  if (!pg) {
    const { data: rows } = await admin
      .from("builder_pages")
      .select("name, seo_title, seo_description, og_image, noindex")
      .eq("site_id", site.id)
      .order("sort_order", { ascending: true })
      .limit(1);
    pg = rows?.[0] ?? null;
  }

  const title =
    pg?.seo_title?.trim() ||
    (pg?.name ? `${pg.name} · ${site.title}` : site.title) ||
    "Site";
  const description = pg?.seo_description?.trim() || undefined;
  const ogImage = pg?.og_image?.trim() || undefined;

  return {
    title,
    description,
    robots: pg?.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: ogImage
      ? { card: "summary_large_image", title, description, images: [ogImage] }
      : undefined,
  };
}

export default async function PublicBuilderPage({ params }: Props) {
  const path = (params.path ?? []).join("/");
  const admin = createAdminClient();

  const { data: site } = await admin
    .from("builder_sites")
    .select("id, user_id, title, is_published, header_json, footer_json, contacts_json")
    .eq("slug", params.slug)
    .maybeSingle();
  // Only published sites are publicly visible.
  if (!site || !site.is_published) notFound();

  // Resolve the page by path; fall back to the first page (home).
  const cols = "id, name, content_json, page_type, background_style, bottombar_json, access_password";
  let { data: page } = await admin
    .from("builder_pages")
    .select(cols)
    .eq("site_id", site.id)
    .eq("path", path)
    .maybeSingle();
  if (!page) {
    const { data: pages } = await admin
      .from("builder_pages")
      .select(cols)
      .eq("site_id", site.id)
      .order("sort_order", { ascending: true })
      .limit(1);
    page = pages?.[0] ?? null;
  }
  if (!page) notFound();

  // Password gate (migration 092) — no-op unless the seller set a password.
  const pw = (page.access_password as string | null) ?? "";
  if (pw) {
    const cookie = cookies().get(unlockCookieName(page.id as string))?.value;
    if (!isUnlocked(page.id as string, pw, cookie)) {
      return <PagePasswordGate pageId={page.id as string} title={(page.name as string) ?? undefined} />;
    }
  }

  // Phase 15 — tenant ad pixels + first-party PageView for this builder site.
  const sellerId = site.user_id as string;
  const m = await loadMarketing(sellerId, admin);
  const pixels = m
    ? {
        meta_pixel_id: m.enable_meta_pixel ? m.meta_pixel_id : null,
        ga4_id: m.enable_ga4 ? m.ga4_id : null,
        custom_head_html: m.custom_head_html,
      }
    : null;

  return (
    <>
      <TrackingProvider sellerId={sellerId} pageType="builder" pixels={pixels} />
      <PublicSite site={site} page={page} />
    </>
  );
}
