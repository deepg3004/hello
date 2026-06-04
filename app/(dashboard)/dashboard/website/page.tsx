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
      .select("subdomain, avatar_url, bio, tagline, brand_color, social_links")
      .eq("id", user.id)
      .single(),
    admin
      .from("site_pages")
      .select("id, slug, title, nav_label, is_home, show_in_nav, status, blocks")
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
