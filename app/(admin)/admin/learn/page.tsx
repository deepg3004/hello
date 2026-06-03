import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  LearnAdminClient,
  type AdminLearnVideo,
} from "@/components/admin/LearnAdminClient";

export const metadata = { title: "Admin · Creator Academy" };

const SETTING_KEYS = [
  "learn_hero_label",
  "learn_hero_heading",
  "learn_hero_image_url",
  "learn_resources_title",
  "learn_resources_bullets",
  "learn_resources_cta_label",
  "learn_resources_cta_url",
];

export default async function AdminLearnPage() {
  const admin = createAdminClient();
  const [{ data: settingsRows }, { data: videos }] = await Promise.all([
    admin.from("platform_settings").select("key, value").in("key", SETTING_KEYS),
    admin
      .from("learn_videos")
      .select(
        "id, section, title, description, video_url, thumbnail_url, duration_label, badge_label, cta_label, is_published",
      )
      .order("sort_order", { ascending: true }),
  ]);

  const settings: Record<string, string> = {};
  for (const r of settingsRows ?? []) settings[r.key] = (r.value as string) ?? "";

  const all = (videos ?? []) as AdminLearnVideo[];

  return (
    <div className="space-y-6">
      <div>
        <DashboardHero
          title="Creator Academy"
          blurb="Manage the seller-facing Learn page — hero, masterclass, resources, and both video carousels."
          resourcesHref={null}
        />
      </div>

      <div className="animate-in-up" style={{ animationDelay: "80ms" }}>
        <LearnAdminClient
          settings={settings}
          featured={all.find((v) => v.section === "featured") ?? null}
          useInvoxai={all.filter((v) => v.section === "use_invoxai")}
          niche={all.filter((v) => v.section === "niche")}
        />
      </div>
    </div>
  );
}
