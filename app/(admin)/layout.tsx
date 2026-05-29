import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import type { AdminTopbarProfile } from "@/components/admin/AdminTopbar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, full_name, email, is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    // Not an admin — bounce to the seller dashboard.
    redirect("/dashboard");
  }

  const topbarProfile: AdminTopbarProfile = {
    full_name: profile.full_name ?? null,
    email: profile.email ?? user.email ?? "",
  };

  return <AdminShell profile={topbarProfile}>{children}</AdminShell>;
}
