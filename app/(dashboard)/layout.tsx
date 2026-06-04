import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { TopbarProfile } from "@/components/dashboard/Topbar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isMaintenanceOn } from "@/lib/maintenance";
import { getBranding } from "@/lib/settings";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const admin = createAdminClient();
  const { data: profileRow } = await admin
    .from("user_profiles")
    .select(
      "id, full_name, email, avatar_url, subscription_plan, subscription_status, is_admin, phone_verified, subdomain",
    )
    .eq("id", user.id)
    .single();

  // Safety net — guarantee every seller has a subdomain even if the signup /
  // callback hooks and the backfill all missed them. Non-blocking.
  if (profileRow && !profileRow.subdomain) {
    void import("@/lib/subdomain").then(({ ensureSubdomainForUser }) =>
      ensureSubdomainForUser(
        user.id,
        profileRow.full_name ?? profileRow.email ?? "seller",
      ),
    );
  }

  // Maintenance gate — admins bypass so they can flip the flag back off.
  if (!profileRow?.is_admin && (await isMaintenanceOn())) {
    redirect("/maintenance");
  }

  // Phone-verification gate — new sellers must verify their number before the
  // dashboard unlocks. Admins bypass; existing users are grandfathered (the
  // migration backfills phone_verified=true) so only fresh signups are gated.
  if (!profileRow?.is_admin && profileRow?.phone_verified === false) {
    redirect("/verify-phone");
  }

  const branding = await getBranding();

  const profile: TopbarProfile = {
    full_name: profileRow?.full_name ?? null,
    email: profileRow?.email ?? user.email ?? "",
    avatar_url: profileRow?.avatar_url ?? null,
    subscription_plan: profileRow?.subscription_plan ?? "free",
    subscription_status: profileRow?.subscription_status ?? "inactive",
  };

  return (
    <DashboardShell profile={profile} branding={branding}>
      {children}
    </DashboardShell>
  );
}
