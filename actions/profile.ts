"use server";

import { revalidatePath } from "next/cache";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidGstin, isValidPhone } from "@/lib/validators";

interface Result {
  ok: boolean;
  message?: string;
}

export interface ProfileInput {
  full_name: string;
  phone?: string;
  gstin?: string;
}

/**
 * Update the seller's own profile (name / phone / GSTIN). Scoped to the
 * session user — never trusts a client-supplied id.
 */
export async function updateProfileAction(input: ProfileInput): Promise<Result> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const full_name = input.full_name?.trim() ?? "";
  if (!full_name) return { ok: false, message: "Full name is required" };
  if (full_name.length > 80) return { ok: false, message: "Name is too long" };

  const phone = input.phone?.trim() || null;
  if (phone && !isValidPhone(phone)) {
    return { ok: false, message: "Enter a valid phone number" };
  }

  const gstin = input.gstin?.trim().toUpperCase() || null;
  if (gstin && !isValidGstin(gstin)) {
    return { ok: false, message: "That doesn't look like a valid 15-character GSTIN" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({ full_name, phone, gstin })
    .eq("id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Save just the phone number (used by the KYC Basics step). Session-scoped. */
export async function updatePhoneAction(phoneRaw: string): Promise<Result> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const phone = phoneRaw.trim();
  if (!isValidPhone(phone)) {
    return { ok: false, message: "Enter a valid phone number" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({ phone })
    .eq("id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/kyc");
  return { ok: true };
}
