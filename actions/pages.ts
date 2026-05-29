"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplate } from "@/lib/templates/registry";
import { isValidSlug } from "@/lib/templates/utils";

export interface CreatePageInput {
  type: "payment" | "landing" | "lead_magnet";
  templateId: string;
  title: string;
  slug: string;
  values: Record<string, unknown>;
  publish: boolean;
}

export interface UpdatePageInput {
  id: string;
  title: string;
  slug: string;
  values: Record<string, unknown>;
  status: "draft" | "published" | "paused" | "archived";
  meta_title: string | null;
  meta_description: string | null;
  custom_domain: string | null;
  pixel: {
    meta_pixel_id: string;
    google_ads_id: string;
    google_ads_label: string;
    tiktok_pixel_id: string;
    hotjar_id: string;
  };
}

export interface PageActionResult {
  ok: boolean;
  message?: string;
  pageId?: string;
  slug?: string;
}

export async function createPageAction(
  input: CreatePageInput,
): Promise<PageActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  if (!isValidSlug(input.slug)) {
    return { ok: false, message: "Invalid slug format" };
  }
  const template = getTemplate(input.templateId);
  if (!template) return { ok: false, message: "Template not found" };

  const admin = createAdminClient();

  // Uniqueness check (admin client — sees all rows)
  const { data: existing } = await admin
    .from("pages")
    .select("id")
    .eq("slug", input.slug)
    .maybeSingle();
  if (existing) return { ok: false, message: "Slug already taken" };

  const { data, error } = await admin
    .from("pages")
    .insert({
      user_id: user.id,
      title: input.title,
      slug: input.slug,
      type: input.type,
      status: input.publish ? "published" : "draft",
      template_id: input.templateId,
      page_config: input.values,
      published_at: input.publish ? new Date().toISOString() : null,
    })
    .select("id, slug")
    .single();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Insert failed" };
  }

  revalidatePath(`/p/${data.slug}`);
  return { ok: true, pageId: data.id, slug: data.slug };
}

export async function updatePageAction(
  input: UpdatePageInput,
): Promise<PageActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  if (!isValidSlug(input.slug)) {
    return { ok: false, message: "Invalid slug format" };
  }

  const admin = createAdminClient();

  // Verify ownership
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id, slug")
    .eq("id", input.id)
    .single();
  if (!page || page.user_id !== user.id) {
    return { ok: false, message: "Not allowed" };
  }

  if (page.slug !== input.slug) {
    const { data: clash } = await admin
      .from("pages")
      .select("id")
      .eq("slug", input.slug)
      .neq("id", input.id)
      .maybeSingle();
    if (clash) return { ok: false, message: "Slug already taken" };
  }

  const wasPublished = page.slug ? true : false;
  const publishingNow = input.status === "published";

  const { error: pageErr } = await admin
    .from("pages")
    .update({
      title: input.title,
      slug: input.slug,
      page_config: input.values,
      status: input.status,
      meta_title: input.meta_title,
      meta_description: input.meta_description,
      custom_domain: input.custom_domain,
      published_at:
        publishingNow && !wasPublished
          ? new Date().toISOString()
          : undefined,
    })
    .eq("id", input.id);

  if (pageErr) return { ok: false, message: pageErr.message };

  // Pixel configs — upsert (one row per page).
  const pixelHasAny = Object.values(input.pixel).some((v) => v && v.length > 0);
  if (pixelHasAny) {
    const { data: existingPixel } = await admin
      .from("pixel_configs")
      .select("id")
      .eq("page_id", input.id)
      .maybeSingle();
    if (existingPixel) {
      await admin
        .from("pixel_configs")
        .update(input.pixel)
        .eq("id", existingPixel.id);
    } else {
      await admin
        .from("pixel_configs")
        .insert({ page_id: input.id, ...input.pixel });
    }
  }

  revalidatePath(`/p/${input.slug}`);
  if (page.slug && page.slug !== input.slug) revalidatePath(`/p/${page.slug}`);
  return { ok: true, pageId: input.id, slug: input.slug };
}
