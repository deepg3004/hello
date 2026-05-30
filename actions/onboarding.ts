"use server";

import { revalidatePath } from "next/cache";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Result {
  ok: boolean;
  message?: string;
}

/** Mark the seller as onboarded — closes the welcome banner everywhere. */
export async function completeOnboardingAction(): Promise<Result> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/onboarding");
  return { ok: true };
}

/** Just dismiss the welcome banner — the seller can still revisit /onboarding. */
export async function dismissWelcomeBannerAction(): Promise<Result> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({ welcome_dismissed_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
