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
import { PageStatCard } from "@/components/dashboard/pages/PageStatCard";

export const metadata = { title: "Store" };

const SPARK = [4, 6, 5, 7, 6, 8, 7, 9];

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

  // Active products + which sit on a published page (what the store shows).
  const { data: productsRaw } = await admin
    .from("products")
    .select("id, pages!products_page_id_fkey(status)")
    .eq("user_id", user.id)
    .eq("active", true);
  const totalActive = (productsRaw ?? []).length;
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
        gradient="from-emerald-600 via-teal-600 to-green-600"
        resourcesHref={null}
      />

      <div
        className="flex flex-wrap gap-4 animate-in-up"
        style={{ animationDelay: "60ms" }}
      >
        <PageStatCard
          label="Live products"
          value={liveCount.toLocaleString("en-IN")}
          trendPct={null}
          spark={SPARK}
          color="#10b981"
        />
        <PageStatCard
          label="Active products"
          value={totalActive.toLocaleString("en-IN")}
          trendPct={null}
          spark={SPARK}
          color="#6366f1"
        />
        <PageStatCard
          label="Storefront"
          value={subdomain ? "Open" : "Setup"}
          trendPct={null}
          spark={SPARK}
          color="#8b5cf6"
        />
      </div>

      <div className="animate-in-up" style={{ animationDelay: "120ms" }}>
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
    </div>
  );
}
