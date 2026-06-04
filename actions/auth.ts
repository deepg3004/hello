"use server";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}

export interface ActionResult {
  ok: boolean;
  message?: string;
  /** If true, the user needs to confirm their email before they can log in. */
  needsEmailConfirmation?: boolean;
}

/**
 * Server-side signup. Creates an auth.users row (which fires the
 * handle_new_user trigger to populate user_profiles), then patches phone via
 * the admin client.
 *
 * Returning a structured object instead of redirecting lets the client show
 * the "check your email" prompt without a navigation.
 */
export async function signUpAction(input: SignUpInput): Promise<ActionResult> {
  const supabase = createClient();
  const origin = headers().get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard/onboarding`,
      data: {
        full_name: input.fullName,
        phone: input.phone,
      },
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  // The DB trigger only writes full_name. Patch phone via admin so it's saved
  // even if the user never visits onboarding.
  if (data.user?.id && input.phone) {
    try {
      const admin = createAdminClient();
      await admin
        .from("user_profiles")
        .update({ phone: input.phone, full_name: input.fullName })
        .eq("id", data.user.id);
    } catch {
      // Patch is best-effort. Onboarding will reconcile.
    }
  }

  // Auto-assign a personal subdomain so the seller's store is live immediately.
  // Best-effort — onboarding / the dashboard layout reconcile if this misses.
  if (data.user?.id) {
    try {
      const { ensureSubdomainForUser } = await import("@/lib/subdomain");
      await ensureSubdomainForUser(data.user.id, input.fullName || input.email);
    } catch {
      /* best-effort */
    }
  }

  // Welcome email to the new seller (best-effort — never block signup).
  try {
    const { enqueueEmail } = await import("@/lib/queues/email");
    await enqueueEmail({
      template: "welcome",
      to: input.email,
      data: { seller_name: input.fullName },
    });
  } catch {
    /* best-effort */
  }

  // When email confirmation is on, session is null until they click the link.
  const needsEmailConfirmation = !data.session;
  return { ok: true, needsEmailConfirmation };
}

/**
 * Request a password reset email. Always returns ok=true to avoid leaking
 * which emails are registered.
 */
export async function requestPasswordResetAction(
  email: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const origin = headers().get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  return { ok: true };
}

export async function updatePasswordAction(
  newPassword: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
