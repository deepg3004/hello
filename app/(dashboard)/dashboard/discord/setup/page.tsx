import { redirect } from "next/navigation";

import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DiscordSetupWizard } from "@/components/dashboard/discord/DiscordSetupWizard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Connect Discord" };

export default async function DiscordSetupPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: pagesRaw } = await admin
    .from("pages")
    .select("id, title, slug")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const pages = ((pagesRaw ?? []) as Array<{
    id: string;
    title: string | null;
    slug: string | null;
  }>).map((p) => ({ id: p.id, title: p.title ?? p.slug ?? "Untitled page" }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <DashboardHero
        title="Connect Discord"
        blurb="Add your bot to a server, link a sales page, and buyers get an automatic invite after they pay."
        resourcesHref={null}
      />
      <DiscordSetupWizard pages={pages} />
    </div>
  );
}
