import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformRootDomain } from "@/lib/domains";
import {
  ProfileBrandingForm,
  type BrandingInitial,
} from "@/components/dashboard/website/ProfileBrandingForm";
import {
  SitePagesManager,
  type SitePage,
} from "@/components/dashboard/website/SitePagesManager";
import { AppearanceForm } from "@/components/dashboard/website/AppearanceForm";
import { SiteSettingsForm } from "@/components/dashboard/website/SiteSettingsForm";

export const metadata = { title: "Website — InvoxAI" };

export default async function WebsitePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [{ data: profile }, { data: pages }] = await Promise.all([
    admin
      .from("user_profiles")
      .select(
        "subdomain, avatar_url, bio, tagline, brand_color, social_links, creator_category, site_config",
      )
      .eq("id", user.id)
      .single(),
    admin
      .from("site_pages")
      .select("id, slug, title, nav_label, is_home, show_in_nav, status, blocks, seo_title, seo_description")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
  ]);

  const storeUrl = profile?.subdomain
    ? `https://${profile.subdomain}.${platformRootDomain()}`
    : null;

  const branding: BrandingInitial = {
    avatar_url: profile?.avatar_url ?? "",
    bio: profile?.bio ?? "",
    tagline: profile?.tagline ?? "",
    brand_color: profile?.brand_color ?? "",
    social_links: (profile?.social_links as Record<string, string>) ?? {},
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-sora text-2xl font-semibold tracking-tight">Website</h1>
        <p className="text-sm text-muted-foreground">
          Build the pages on your store address.{" "}
          {storeUrl ? (
            <a href={storeUrl} target="_blank" rel="noreferrer" className="text-primary underline">
              {storeUrl.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            "Claim a subdomain in Settings → Domains first."
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branding & profile</CardTitle>
          <CardDescription>
            Your photo, bio, brand colour and social links — used across your site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileBrandingForm initial={branding} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>
            Pick a colour theme for your website. Light and dark palettes available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AppearanceForm
            initialTheme={
              ((profile?.site_config as Record<string, unknown>)?.theme as string) ?? null
            }
            initialFont={
              ((profile?.site_config as Record<string, unknown>)?.font as string) ?? null
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Footer & site settings</CardTitle>
          <CardDescription>
            Footer text & links, favicon, and the image shown when your site is shared.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SiteSettingsForm
            initial={{
              footer_text:
                ((profile?.site_config as Record<string, unknown>)?.footer_text as string) ?? "",
              favicon:
                ((profile?.site_config as Record<string, unknown>)?.favicon as string) ?? "",
              og_image:
                ((profile?.site_config as Record<string, unknown>)?.og_image as string) ?? "",
              footer_links: Array.isArray(
                (profile?.site_config as Record<string, unknown>)?.footer_links,
              )
                ? ((profile?.site_config as Record<string, unknown>)
                    .footer_links as Array<{ label: string; url: string }>)
                : [],
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pages & sections</CardTitle>
          <CardDescription>
            Add pages, then build each from drag-ordered sections (hero, about,
            products, gallery, FAQ and more).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SitePagesManager
            initialPages={(pages ?? []) as SitePage[]}
            storeUrl={storeUrl}
            creatorCategory={profile?.creator_category ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
