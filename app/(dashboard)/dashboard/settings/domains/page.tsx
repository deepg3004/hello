import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  appRootHost,
  customDomainTargetIps,
  platformRootDomain,
} from "@/lib/domains";
import type { DcvRecord } from "@/lib/cloudflare";
import { DomainSettingsForm } from "@/components/dashboard/DomainSettingsForm";

export const metadata = { title: "Domains · Settings" };

export default async function DomainsSettingsPage() {
  const ctx = await requirePageActor("domains.view", "/dashboard/settings/domains");

  const admin = createAdminClient();
  const [{ data: profile }, { data: flag }] = await Promise.all([
    admin
      .from("user_profiles")
      .select(
        "subdomain, subdomain_claimed_at, custom_domain, custom_domain_verified_at, custom_domain_cert_status, custom_domain_last_checked_at, custom_domain_last_error, custom_domain_dcv, subdomain_redirect_to_custom, subscription_plan",
      )
      .eq("id", ctx.ownerId)
      .single(),
    admin
      .from("platform_settings")
      .select("value")
      .eq("key", "feature_custom_domains")
      .maybeSingle(),
  ]);

  const plan = (profile?.subscription_plan ?? "free") as string;
  // Custom domains are available to every seller — only the platform-wide
  // feature flag can switch them off (no plan gate).
  const canUseCustomDomains = flag?.value !== "false";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">Domains</h1>
        <p className="text-sm text-muted-foreground">
          Pick a subdomain everyone can remember, or bring your own.
        </p>
      </div>

      <DomainSettingsForm
        rootDomain={platformRootDomain()}
        appRootHost={appRootHost()}
        customDomainTarget={customDomainTargetIps()[0] ?? "187.127.172.108"}
        subdomainRedirectToCustom={
          profile?.subdomain_redirect_to_custom ?? false
        }
        subdomain={profile?.subdomain ?? null}
        subdomainClaimedAt={profile?.subdomain_claimed_at ?? null}
        customDomain={profile?.custom_domain ?? null}
        customDomainVerifiedAt={profile?.custom_domain_verified_at ?? null}
        customDomainCertStatus={
          (profile?.custom_domain_cert_status ?? null) as
            | "pending"
            | "provisioning"
            | "active"
            | "failed"
            | null
        }
        customDomainLastCheckedAt={profile?.custom_domain_last_checked_at ?? null}
        customDomainLastError={profile?.custom_domain_last_error ?? null}
        customDomainDcv={
          (profile?.custom_domain_dcv ?? null) as DcvRecord[] | null
        }
        canUseCustomDomains={canUseCustomDomains}
        plan={plan}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How routing works</CardTitle>
          <CardDescription>
            Both addresses point at the same Next.js app — the server reads
            the host header to figure out whose pages to render.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <Badge variant="outline">/p/[slug]</Badge> still works for shared
            preview links and SEO meta tags.
          </p>
          <p>
            <Badge variant="outline">subdomain</Badge> and{" "}
            <Badge variant="outline">custom domain</Badge> serve the same page
            at the root: <code>subdomain.invoxai.io/my-course</code>{" "}
            and <code>pages.you.com/my-course</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
