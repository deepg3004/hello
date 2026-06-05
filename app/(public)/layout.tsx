import { redirect } from "next/navigation";

import { isMaintenanceOn } from "@/lib/maintenance";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConditionalPolicyFooter } from "@/components/public/ConditionalPolicyFooter";

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

  // overflow-x-clip stops decorative blur-glows on the templates from causing
  // horizontal scroll on phones (clip doesn't create a scroll container or
  // affect sticky/fixed CTAs, unlike overflow-x-hidden).
  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      {children}
      {/* Hidden on themed course pages (they have their own branded footer);
          kept on marketing / payment pages that require the legal links. */}
      <ConditionalPolicyFooter />
    </div>
  );
}
