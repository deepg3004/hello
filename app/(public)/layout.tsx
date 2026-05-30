import { redirect } from "next/navigation";

import { isMaintenanceOn } from "@/lib/maintenance";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Maintenance gate. Admins always bypass — they need a way to flip it
  // back off. Everyone else lands on /maintenance.
  if (await isMaintenanceOn()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let isAdmin = false;
    if (user) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("user_profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      isAdmin = !!data?.is_admin;
    }
    if (!isAdmin) redirect("/maintenance");
  }

  return <div className="min-h-screen bg-background">{children}</div>;
}
