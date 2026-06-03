import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LearnClient, type LearnVideo } from "@/components/dashboard/learn/LearnClient";

export const metadata = { title: "Learn" };

const SETTING_KEYS = [
  "learn_hero_label",
  "learn_hero_heading",
  "learn_hero_image_url",
  "learn_resources_title",
  "learn_resources_bullets",
  "learn_resources_cta_label",
  "learn_resources_cta_url",
];

export default async function LearnPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [{ data: settingsRows }, { data: videos }] = await Promise.all([
    admin.from("platform_settings").select("key, value").in("key", SETTING_KEYS),
    admin
      .from("learn_videos")
      .select(
        "id, section, title, description, video_url, thumbnail_url, duration_label, badge_label, cta_label",
      )
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
  ]);

  const s: Record<string, string> = {};
  for (const r of settingsRows ?? []) s[r.key] = (r.value as string) ?? "";

  const all = (videos ?? []) as LearnVideo[];
  const featured = all.find((v) => v.section === "featured") ?? null;
  const useInvoxai = all.filter((v) => v.section === "use_invoxai");
  const niche = all.filter((v) => v.section === "niche");

  const heroLabel = s.learn_hero_label || "Creator Academy";
  const heroHeading = s.learn_hero_heading || "Learn how to grow and sell with invoxai";
  const heroImage = s.learn_hero_image_url || "";

  return (
    // Break out of the dashboard's padding so the hero spans the content area.
    <div className="-mx-4 -mt-6 md:-mx-8 md:-mt-8">
      {/* ── SECTION A: HERO ─────────────────────────────────────────────── */}
      <section className="relative flex h-[220px] items-center justify-center overflow-hidden bg-[#0c0f0d] sm:h-[260px] md:h-[300px]">
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt=""
            className="absolute inset-0 h-full w-full scale-105 object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1d2c20] via-[#10130f] to-[#0a0d0a]" />
        )}
        {/* Layered overlay: keeps text legible over any image while letting a
            hint of the photo + a soft emerald glow show through. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/65 to-black/80" />
        <div className="pointer-events-none absolute -top-1/3 left-1/2 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 px-6 text-center">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] font-medium text-white/85 backdrop-blur">
            <GraduationCap className="h-3.5 w-3.5" />
            {heroLabel}
          </p>
          <h1
            className="mx-auto max-w-3xl font-sora font-bold tracking-tight text-white"
            style={{ fontSize: "clamp(28px, 4.4vw, 50px)", lineHeight: 1.15 }}
          >
            {heroHeading}
          </h1>
        </div>
      </section>

      {/* White content area (Sections B–D) */}
      <div className="min-h-[60vh] bg-card px-4 pb-12 pt-7 md:px-8">
        <LearnClient
          featured={featured}
          useInvoxai={useInvoxai}
          niche={niche}
          resources={{
            title: s.learn_resources_title || "Resources for Creators",
            bullets: (s.learn_resources_bullets || "")
              .split("\n")
              .map((b) => b.trim())
              .filter(Boolean),
            ctaLabel: s.learn_resources_cta_label || "Access Resources",
            ctaUrl: s.learn_resources_cta_url || "",
          }}
        />
      </div>
    </div>
  );
}
