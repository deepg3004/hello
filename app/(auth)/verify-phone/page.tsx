import { redirect } from "next/navigation";

import { PhoneVerifyForm } from "@/components/auth/PhoneVerifyForm";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Verify your phone · InvoxAI" };

export default async function VerifyPhonePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/verify-phone");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("phone, phone_verified")
    .eq("id", user.id)
    .single();

  // Already verified (or grandfathered) — straight to the app.
  if (profile?.phone_verified) redirect("/dashboard");

  return <PhoneVerifyForm initialPhone={profile?.phone ?? ""} />;
}
