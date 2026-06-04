import { notFound, redirect } from "next/navigation";

import { PageEditorTabs, type ExistingPage } from "@/components/dashboard/PageBuilder/EditorTabs";
import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Edit page",
};

export default async function EditPageRoute({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requirePageActor("pages.view", "/dashboard/pages");

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select(
      "id, user_id, title, slug, type, status, template_id, page_config, meta_title, meta_description, custom_domain",
    )
    .eq("id", params.id)
    .single();

  if (!page) notFound();
  if (page.user_id !== ctx.ownerId) redirect("/dashboard");

  const [
    { data: pixel },
    { data: products },
    { data: coupons },
    { data: profile },
    { data: sys },
    { data: pageProduct },
  ] = await Promise.all([
    admin
      .from("pixel_configs")
      .select(
        "meta_pixel_id, meta_capi_access_token, meta_fire_purchase, meta_fire_lead, google_ads_id, google_ads_label, google_fire_conversion, tiktok_pixel_id, hotjar_id, clarity_id, custom_script",
      )
      .eq("page_id", params.id)
      .maybeSingle(),
    admin
      .from("products")
      .select("id, name, price")
      .eq("user_id", ctx.ownerId)
      .eq("active", true)
      .order("created_at", { ascending: false }),
    admin
      .from("coupons")
      .select("code")
      .eq("user_id", ctx.ownerId)
      .eq("active", true),
    admin
      .from("user_profiles")
      .select("subscription_plan")
      .eq("id", ctx.ownerId)
      .single(),
    admin
      .from("platform_settings")
      .select("value")
      .eq("key", "allow_custom_scripts")
      .maybeSingle(),
    // This page's own active product (for the Offer / Retail price fields).
    admin
      .from("products")
      .select("price, original_price")
      .eq("page_id", params.id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const customScriptsAllowed = sys?.value === "true";

  const existing: ExistingPage = {
    id: page.id,
    title: page.title,
    slug: page.slug,
    type: page.type as ExistingPage["type"],
    status: page.status as ExistingPage["status"],
    template_id: page.template_id,
    page_config: (page.page_config as Record<string, unknown>) ?? {},
    meta_title: page.meta_title,
    meta_description: page.meta_description,
    custom_domain: page.custom_domain,
    pixel: pixel ?? null,
    products: (products ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price ?? 0),
    })),
    coupons: (coupons ?? []).map((c) => ({ code: c.code as string })),
    customScriptsAllowed,
    sellerPlan: (profile?.subscription_plan as string) ?? "free",
    productPrice:
      pageProduct?.price != null ? Number(pageProduct.price) : null,
    productOriginalPrice:
      pageProduct?.original_price != null
        ? Number(pageProduct.original_price)
        : null,
  };

  return <PageEditorTabs initial={existing} />;
}
