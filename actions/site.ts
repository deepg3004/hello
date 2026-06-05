"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";

interface Ok {
  ok: true;
  message?: string;
  pageId?: string;
}
interface Err {
  ok: false;
  message: string;
}
type Result = Ok | Err;

const RESERVED_SITE_SLUGS = new Set([
  "course",
  "p",
  "tg",
  "ln",
  "ld",
  "order",
  "affiliate",
  "preview",
  "privacy",
  "terms",
  "refund",
]);

function slugify(input: string): string {
  return (input || "page")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "") || "page";
}

// Returns { id: effective-owner-id } when the actor may manage the website,
// else null. All site.ts actions mutate the owner's website.
async function requireUser() {
  const actor = await requireActor("website.manage");
  return actor.ok ? { id: actor.ctx.ownerId } : null;
}

/** Create a new site page with a unique slug, optionally seeded with blocks
 *  (e.g. from a starter preset). */
export async function createSitePageAction(input: {
  title?: string;
  blocks?: unknown;
  publish?: boolean;
}): Promise<Result> {
  const user = await requireUser();
  if (!user) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();

  const title = input.title?.trim() || "New page";
  const base = slugify(title);

  // Dedupe slug against this seller's existing pages + reserved roots.
  const { data: existing } = await admin
    .from("site_pages")
    .select("slug")
    .eq("user_id", user.id);
  const taken = new Set([
    ...RESERVED_SITE_SLUGS,
    ...((existing ?? []).map((r) => r.slug).filter(Boolean) as string[]),
  ]);
  let slug = base;
  let n = 1;
  while (taken.has(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }

  const isFirst = (existing ?? []).length === 0;

  const { data, error } = await admin
    .from("site_pages")
    .insert({
      user_id: user.id,
      slug,
      title,
      nav_label: title,
      is_home: isFirst, // first page becomes the home page
      sort_order: (existing ?? []).length,
      blocks: Array.isArray(input.blocks) ? input.blocks : [],
      status: input.publish ? "published" : "draft",
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/website");
  return { ok: true, pageId: data.id };
}

/** Update a site page's content / metadata. Session-scoped. */
export async function updateSitePageAction(input: {
  id: string;
  title?: string;
  nav_label?: string;
  blocks?: unknown;
  status?: "draft" | "published";
  show_in_nav?: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
}): Promise<Result> {
  const user = await requireUser();
  if (!user) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title.trim() || "Untitled";
  if (input.nav_label !== undefined) patch.nav_label = input.nav_label.trim() || null;
  if (input.blocks !== undefined)
    patch.blocks = Array.isArray(input.blocks) ? input.blocks : [];
  if (input.status !== undefined) patch.status = input.status;
  if (input.show_in_nav !== undefined) patch.show_in_nav = input.show_in_nav;
  if (input.seo_title !== undefined) patch.seo_title = input.seo_title;
  if (input.seo_description !== undefined) patch.seo_description = input.seo_description;

  const { error } = await admin
    .from("site_pages")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/website");
  return { ok: true };
}

/** Delete a site page. */
export async function deleteSitePageAction(id: string): Promise<Result> {
  const user = await requireUser();
  if (!user) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("site_pages")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard/website");
  return { ok: true };
}

/** Reorder site pages — `ids` in the desired order sets sort_order = index. */
export async function reorderSitePagesAction(ids: string[]): Promise<Result> {
  const user = await requireUser();
  if (!user) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();
  await Promise.all(
    ids.map((id, i) =>
      admin
        .from("site_pages")
        .update({ sort_order: i })
        .eq("id", id)
        .eq("user_id", user.id),
    ),
  );
  revalidatePath("/dashboard/website");
  return { ok: true };
}

/** Make a page the home page (rendered at the subdomain root). */
export async function setHomeSitePageAction(id: string): Promise<Result> {
  const user = await requireUser();
  if (!user) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();

  // Clear any existing home first to satisfy the partial-unique index.
  await admin
    .from("site_pages")
    .update({ is_home: false })
    .eq("user_id", user.id)
    .eq("is_home", true);
  const { error } = await admin
    .from("site_pages")
    .update({ is_home: true })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/website");
  return { ok: true };
}

/** Save the seller's branding/profile fields used by their website. */
export async function saveBrandingAction(input: {
  bio?: string;
  tagline?: string;
  brand_color?: string;
  avatar_url?: string;
  social_links?: Record<string, string>;
}): Promise<Result> {
  const user = await requireUser();
  if (!user) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();

  const patch: Record<string, unknown> = {};
  if (input.bio !== undefined) patch.bio = input.bio.trim() || null;
  if (input.tagline !== undefined) patch.tagline = input.tagline.trim() || null;
  if (input.brand_color !== undefined) patch.brand_color = input.brand_color.trim() || null;
  if (input.avatar_url !== undefined) patch.avatar_url = input.avatar_url.trim() || null;
  if (input.social_links !== undefined) {
    // Keep only non-empty string values for known platforms.
    const allowed = ["instagram", "youtube", "twitter", "linkedin", "telegram", "website"];
    const clean: Record<string, string> = {};
    for (const k of allowed) {
      const v = input.social_links[k]?.trim();
      if (v) clean[k] = v;
    }
    patch.social_links = clean;
  }

  const { error } = await admin
    .from("user_profiles")
    .update(patch)
    .eq("id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/website");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

/** Save the website appearance (theme palette + font) into site_config. */
export async function saveSiteAppearanceAction(input: {
  theme?: string;
  font?: string;
}): Promise<Result> {
  const user = await requireUser();
  if (!user) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();

  const { data: prof } = await admin
    .from("user_profiles")
    .select("site_config")
    .eq("id", user.id)
    .single();
  const cfg = ((prof?.site_config as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  if (input.theme !== undefined) cfg.theme = input.theme;
  if (input.font !== undefined) cfg.font = input.font;

  const { error } = await admin
    .from("user_profiles")
    .update({ site_config: cfg })
    .eq("id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/website");
  return { ok: true };
}

/** Save website-wide settings: footer text/links, favicon, OG image. */
export async function saveSiteSettingsAction(input: {
  footer_text?: string;
  footer_links?: Array<{ label: string; url: string }>;
  footer_columns?: Array<{ title: string; links: Array<{ label: string; url: string }> }>;
  favicon?: string;
  og_image?: string;
}): Promise<Result> {
  const user = await requireUser();
  if (!user) return { ok: false, message: "Not signed in" };
  const admin = createAdminClient();

  const { data: prof } = await admin
    .from("user_profiles")
    .select("site_config")
    .eq("id", user.id)
    .single();
  const cfg = ((prof?.site_config as Record<string, unknown>) ?? {}) as Record<string, unknown>;

  if (input.footer_text !== undefined) cfg.footer_text = input.footer_text.trim() || null;
  if (input.favicon !== undefined) cfg.favicon = input.favicon.trim() || null;
  if (input.og_image !== undefined) cfg.og_image = input.og_image.trim() || null;
  if (input.footer_links !== undefined) {
    cfg.footer_links = input.footer_links
      .map((l) => ({ label: (l.label ?? "").trim(), url: (l.url ?? "").trim() }))
      .filter((l) => l.label && l.url);
  }
  if (input.footer_columns !== undefined) {
    cfg.footer_columns = input.footer_columns
      .map((c) => ({
        title: (c.title ?? "").trim(),
        links: (c.links ?? [])
          .map((l) => ({ label: (l.label ?? "").trim(), url: (l.url ?? "").trim() }))
          .filter((l) => l.label && l.url),
      }))
      .filter((c) => c.title || c.links.length);
  }

  const { error } = await admin
    .from("user_profiles")
    .update({ site_config: cfg })
    .eq("id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/website");
  return { ok: true };
}
