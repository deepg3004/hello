import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Store } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformRootDomain } from "@/lib/domains";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

export const metadata = { title: "Store" };

export default async function StoreDashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/store");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("subdomain")
    .eq("id", user.id)
    .single();

  // Count active products that sit on a published page (what the store shows).
  const { data: productsRaw } = await admin
    .from("products")
    .select("id, pages!products_page_id_fkey(status)")
    .eq("user_id", user.id)
    .eq("active", true);
  const liveCount = (productsRaw ?? []).filter((r) => {
    const rel = (r as { pages?: { status?: string } | { status?: string }[] | null }).pages;
    const page = Array.isArray(rel) ? rel[0] : rel;
    return page?.status === "published";
  }).length;

  const subdomain = profile?.subdomain ?? null;
  const storeUrl = subdomain
    ? `https://${subdomain}.${platformRootDomain()}`
    : null;

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Store"
        blurb="Your subdomain is a public storefront — every active product on a published page shows up automatically."
        resourcesHref={null}
      />

      {storeUrl ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4 text-muted-foreground" /> Your store
            </CardTitle>
            <CardDescription>
              {liveCount} live product{liveCount === 1 ? "" : "s"} · grouped by
              category, each opens its own checkout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <code className="block break-all rounded bg-muted px-3 py-2 text-sm">
              {storeUrl}
            </code>
            <Button asChild>
              <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> View store
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claim a subdomain first</CardTitle>
            <CardDescription>
              Your store lives at your subdomain. Pick one to open your
              storefront.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/settings/domains">Choose a subdomain →</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
