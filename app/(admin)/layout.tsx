import { cookies } from "next/headers";
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

  // Mark this session as an admin so middleware can let them bypass the
  // maintenance gate. Short-lived (1 hour) and refreshed on every admin
  // page render.
  try {
    cookies().set({
      name: "invoxai_is_admin",
      value: "1",
      maxAge: 60 * 60,
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });
  } catch {
    /* read-only rendering path — fine, we'll set on the next request */
  }

  const topbarProfile: AdminTopbarProfile = {
    full_name: profile.full_name ?? null,
    email: profile.email ?? user.email ?? "",
  };

  return <AdminShell profile={topbarProfile}>{children}</AdminShell>;
}
