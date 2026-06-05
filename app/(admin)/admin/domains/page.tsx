// Admin · Domains (Session 16) — every seller subdomain + custom domain, with
// cert status and the last verification error. Read-only oversight.

import {
  AdminDomainsClient,
  type AdminDomainRow,
} from "@/components/admin/AdminDomainsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

export const metadata = { title: "Admin · Domains" };

export default async function AdminDomainsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select(
      "id, full_name, email, subdomain, subdomain_claimed_at, custom_domain, custom_domain_verified_at, custom_domain_cert_status, custom_domain_last_error",
    )
    .not("subdomain", "is", null)
    .order("subdomain_claimed_at", { ascending: false, nullsFirst: false })
    .limit(5000);

  const rows: AdminDomainRow[] = (data ?? []).map((u) => ({
    userId: u.id as string,
    seller: (u.full_name as string) || (u.email as string) || "—",
    email: (u.email as string) ?? "",
    subdomain: (u.subdomain as string) ?? null,
    subdomainClaimedAt: (u.subdomain_claimed_at as string) ?? null,
    customDomain: (u.custom_domain as string) ?? null,
    customVerifiedAt: (u.custom_domain_verified_at as string) ?? null,
    certStatus: (u.custom_domain_cert_status as string) ?? null,
    lastError: (u.custom_domain_last_error as string) ?? null,
  }));

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Domains"
        blurb="All seller subdomains and custom domains, with SSL cert status and last error."
        resourcesHref={null}
      />
      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <AdminDomainsClient rows={rows} />
      </div>
    </div>
  );
}
