"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
import { getTemplate } from "@/lib/templates/registry";
import { isValidSlug, slugify } from "@/lib/templates/utils";
import { PLANS, type PlanKey } from "@/lib/plans";
import { notifyPageCreated } from "@/lib/notifications/events";

export interface CreatePageInput {
  type: "payment" | "landing" | "lead_magnet";
  templateId: string;
  title: string;
  slug: string;
  values: Record<string, unknown>;
  publish: boolean;
  /** Sale price in INR. When set on a payment page, we auto-create a
   *  matching products row attached to the new page so the checkout has
   *  something to charge for. Ignored for landing / lead_magnet pages. */
  price?: number | null;
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
  /** Sale price in INR. When provided on a payment page, we upsert the
   *  associated products row so the public checkout reflects the change. */
  price?: number | null;
  /** Retail / "compare at" price in INR (strikethrough). Stored as the
   *  product's original_price; null clears it. */
  original_price?: number | null;
  pixel: {
    meta_pixel_id: string;
    meta_capi_access_token: string;
    meta_fire_purchase: boolean;
    meta_fire_lead: boolean;
    google_ads_id: string;
    google_ads_label: string;
    google_fire_conversion: boolean;
    tiktok_pixel_id: string;
    hotjar_id: string;
    clarity_id: string;
    custom_script: string;
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
  const actor = await requireActor("pages.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

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
      user_id: ctx.ownerId,
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

  // Auto-create a products row for payment pages with a price. This is the
  // record the public /p/[slug] route loads to render the checkout form.
  // Without it the page renders the "Attach a product to this page to enable
  // checkout" fallback.
  if (input.type === "payment" && input.price && input.price > 0) {
    const { error: productErr } = await admin.from("products").insert({
      user_id: ctx.ownerId,
      page_id: data.id,
      name: input.title,
      price: input.price,
      currency: "INR",
      type: "one_time",
      active: true,
    });
    if (productErr) {
      // Don't fail the whole page creation — log and let the seller fix
      // the price later via the editor.
      console.warn("[createPageAction] product insert failed", productErr);
    }
  }

  // In-app bell — seller + admins. Best-effort.
  await notifyPageCreated(
    {
      sellerId: ctx.ownerId,
      pageId: data.id,
      title: input.title,
      type: input.type,
      published: !!input.publish,
    },
    admin,
  );

  revalidatePath(`/p/${data.slug}`);
  return { ok: true, pageId: data.id, slug: data.slug };
}

export async function updatePageAction(
  input: UpdatePageInput,
): Promise<PageActionResult> {
  const actor = await requireActor("pages.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

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
  if (!page || page.user_id !== ctx.ownerId) {
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

  // Product price — upsert. When the seller types a new price in the editor,
  // either update the existing products row or insert a new one. We DON'T
  // delete rows here — old products may be referenced by historical orders.
  if (typeof input.price === "number" && input.price > 0) {
    const { data: existingProduct } = await admin
      .from("products")
      .select("id")
      .eq("page_id", input.id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Retail price (compare-at). Only persist when it's strictly above the
    // sale price — otherwise clear it so a stale strikethrough doesn't linger.
    const retail =
      typeof input.original_price === "number" &&
      input.original_price > input.price
        ? input.original_price
        : null;

    if (existingProduct) {
      await admin
        .from("products")
        .update({
          price: input.price,
          original_price: retail,
          name: input.title,
        })
        .eq("id", existingProduct.id);
    } else {
      await admin.from("products").insert({
        user_id: ctx.ownerId,
        page_id: input.id,
        name: input.title,
        price: input.price,
        original_price: retail,
        currency: "INR",
        type: "one_time",
        active: true,
      });
    }
  }

  // Pixel configs — upsert (one row per page).
  //   - Booleans always count as "set" so they save even on an otherwise-empty form
  //   - custom_script is gated server-side on (plan ≥ pro) AND (platform allows it)
  const pixelFields = { ...input.pixel };

  if (pixelFields.custom_script && pixelFields.custom_script.trim()) {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("subscription_plan")
      .eq("id", ctx.ownerId)
      .single();
    const plan = (profile?.subscription_plan ?? "free") as string;
    const planAllowed = plan === "pro" || plan === "business";

    const { data: sys } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "allow_custom_scripts")
      .maybeSingle();
    const platformAllowed = sys?.value === "true";

    if (!planAllowed || !platformAllowed) {
      pixelFields.custom_script = "";
    }
  }

  const anyStringSet = Object.entries(pixelFields).some(
    ([, v]) => typeof v === "string" && v.trim().length > 0,
  );
  if (anyStringSet) {
    const { data: existingPixel } = await admin
      .from("pixel_configs")
      .select("id")
      .eq("page_id", input.id)
      .maybeSingle();
    if (existingPixel) {
      await admin
        .from("pixel_configs")
        .update(pixelFields)
        .eq("id", existingPixel.id);
    } else {
      await admin
        .from("pixel_configs")
        .insert({ page_id: input.id, ...pixelFields });
    }
  }

  revalidatePath(`/p/${input.slug}`);
  if (page.slug && page.slug !== input.slug) revalidatePath(`/p/${page.slug}`);
  return { ok: true, pageId: input.id, slug: input.slug };
}

/** Toggle status between published and paused. */
export async function togglePagePublishAction(
  pageId: string,
): Promise<PageActionResult> {
  const actor = await requireActor("pages.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id, slug, status")
    .eq("id", pageId)
    .single();
  if (!page || page.user_id !== ctx.ownerId) {
    return { ok: false, message: "Not allowed" };
  }

  const nextStatus =
    page.status === "published" ? "paused" : "published";
  const publishedAt =
    nextStatus === "published" ? new Date().toISOString() : undefined;

  const { error } = await admin
    .from("pages")
    .update({ status: nextStatus, published_at: publishedAt })
    .eq("id", pageId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/pages");
  revalidatePath(`/p/${page.slug}`);
  return { ok: true, pageId, slug: page.slug };
}

/** Duplicate a page (its config) under a fresh slug. */
export async function duplicatePageAction(
  pageId: string,
): Promise<PageActionResult> {
  const actor = await requireActor("pages.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select(
      "id, user_id, title, slug, type, template_id, page_config, meta_title, meta_description",
    )
    .eq("id", pageId)
    .single();
  if (!page || page.user_id !== ctx.ownerId) {
    return { ok: false, message: "Not allowed" };
  }

  // Plan limit check
  const limitCheck = await checkPageLimit(ctx.ownerId);
  if (!limitCheck.ok) return limitCheck;

  const newTitle = `${page.title} (copy)`;
  const newSlug = await findFreeSlug(`${slugify(page.title)}-copy`);

  const { data: inserted, error } = await admin
    .from("pages")
    .insert({
      user_id: ctx.ownerId,
      title: newTitle,
      slug: newSlug,
      type: page.type,
      status: "draft",
      template_id: page.template_id,
      page_config: page.page_config,
      meta_title: page.meta_title,
      meta_description: page.meta_description,
    })
    .select("id, slug")
    .single();
  if (error || !inserted) {
    return { ok: false, message: error?.message ?? "Duplicate failed" };
  }

  revalidatePath("/dashboard/pages");
  return { ok: true, pageId: inserted.id, slug: inserted.slug };
}

/** Hard delete (the FK cascades will clean child rows). */
export async function deletePageAction(
  pageId: string,
): Promise<PageActionResult> {
  const actor = await requireActor("pages.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select("id, user_id, slug")
    .eq("id", pageId)
    .single();
  if (!page || page.user_id !== ctx.ownerId) {
    return { ok: false, message: "Not allowed" };
  }

  const { error } = await admin.from("pages").delete().eq("id", pageId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/pages");
  revalidatePath(`/p/${page.slug}`);
  return { ok: true, pageId };
}

// ---- helpers ----

async function findFreeSlug(base: string): Promise<string> {
  const admin = createAdminClient();
  const seed = base || `page-${nanoid(6)}`;
  let candidate = seed;
  for (let i = 0; i < 5; i++) {
    const { data } = await admin
      .from("pages")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${seed}-${nanoid(4).toLowerCase()}`;
  }
  return `${seed}-${nanoid(8).toLowerCase()}`;
}

async function checkPageLimit(userId: string): Promise<PageActionResult> {
  const admin = createAdminClient();
  const [{ count }, { data: profile }] = await Promise.all([
    admin
      .from("pages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    admin
      .from("user_profiles")
      .select("subscription_plan, subscription_status")
      .eq("id", userId)
      .single(),
  ]);
  const planKey = (profile?.subscription_plan ?? "free") as PlanKey;
  const effective: PlanKey =
    planKey === "free" ||
    ["active", "trialing"].includes(profile?.subscription_status ?? "")
      ? planKey
      : "free";
  const limit = PLANS[effective in PLANS ? effective : "free"].pages;
  if (limit !== -1 && (count ?? 0) >= limit) {
    return {
      ok: false,
      message: `You're at your ${PLANS[effective].name} plan limit of ${limit} pages. Upgrade to add more.`,
    };
  }
  return { ok: true };
}
