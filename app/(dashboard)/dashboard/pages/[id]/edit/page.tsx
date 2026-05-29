import { notFound, redirect } from "next/navigation";

import { PageEditorTabs, type ExistingPage } from "@/components/dashboard/PageBuilder/EditorTabs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Edit page",
};

export default async function EditPageRoute({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/pages/${params.id}/edit`);

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select(
      "id, user_id, title, slug, type, status, template_id, page_config, meta_title, meta_description, custom_domain",
    )
    .eq("id", params.id)
    .single();

  if (!page) notFound();
  if (page.user_id !== user.id) redirect("/dashboard");

  const { data: pixel } = await admin
    .from("pixel_configs")
    .select(
      "meta_pixel_id, google_ads_id, google_ads_label, tiktok_pixel_id, hotjar_id",
    )
    .eq("page_id", params.id)
    .maybeSingle();

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
  };

  return <PageEditorTabs initial={existing} />;
}
