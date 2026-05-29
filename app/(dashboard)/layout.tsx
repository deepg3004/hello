import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { TopbarProfile } from "@/components/dashboard/Topbar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
      "id, full_name, email, avatar_url, subscription_plan, subscription_status",
    )
    .eq("id", user.id)
    .single();

  const profile: TopbarProfile = {
    full_name: profileRow?.full_name ?? null,
    email: profileRow?.email ?? user.email ?? "",
    avatar_url: profileRow?.avatar_url ?? null,
    subscription_plan: profileRow?.subscription_plan ?? "free",
    subscription_status: profileRow?.subscription_status ?? "inactive",
  };

  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}
