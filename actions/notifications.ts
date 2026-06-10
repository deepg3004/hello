"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
import type {
  NotificationEventKey,
  NotificationEventToggles,
  NotificationsConfig,
} from "@/lib/notifications-config";

interface UpdateInput {
  enabled?: boolean;
  events?: NotificationEventToggles; // WhatsApp toggles
  email?: NotificationEventToggles;
  inapp?: NotificationEventToggles;
  sms?: NotificationEventToggles;
}

const VALID_KEYS: NotificationEventKey[] = [
  "new_sale",
  "payment_failed",
  "new_lead",
  "payout_initiated",
  "payout_completed",
  "kyc_update",
  "subscription_renewal",
];

function sanitiseToggles(
  raw: NotificationEventToggles | undefined,
): NotificationEventToggles | undefined {
  if (!raw) return undefined;
  const out: NotificationEventToggles = {};
  for (const k of VALID_KEYS) {
    if (typeof raw[k] === "boolean") out[k] = raw[k];
  }
  return out;
}

/**
 * Update the signed-in seller's notification preferences. Merges into the
 * existing JSONB so partial updates (e.g. just flipping one event) work.
 */
export async function updateNotificationPrefsAction(
  input: UpdateInput,
): Promise<{ ok: boolean; message?: string }> {
  const actor = await requireActor("notifications.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("notifications_config, whatsapp_verified_number")
    .eq("id", ctx.ownerId)
    .single();

  const current = (profile?.notifications_config as NotificationsConfig | null) ?? {};
  const next: NotificationsConfig = {
    ...current,
    whatsapp_number: profile?.whatsapp_verified_number ?? current.whatsapp_number,
  };
  if (typeof input.enabled === "boolean") next.enabled = input.enabled;
  const events = sanitiseToggles(input.events);
  if (events) next.events = { ...(current.events ?? {}), ...events };
  const email = sanitiseToggles(input.email);
  if (email) next.email = { ...(current.email ?? {}), ...email };
  const inapp = sanitiseToggles(input.inapp);
  if (inapp) next.inapp = { ...(current.inapp ?? {}), ...inapp };
  const sms = sanitiseToggles(input.sms);
  if (sms) next.sms = { ...(current.sms ?? {}), ...sms };

  const { error } = await admin
    .from("user_profiles")
    .update({ notifications_config: next })
    .eq("id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings/notifications");
  return { ok: true };
}

/**
 * Remove a verified WhatsApp number — keeps event toggles intact but disables
 * the master switch.
 */
export async function removeWhatsAppNumberAction(): Promise<{
  ok: boolean;
  message?: string;
}> {
  const actor = await requireActor("notifications.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("notifications_config")
    .eq("id", ctx.ownerId)
    .single();
  const current = (profile?.notifications_config as NotificationsConfig | null) ?? {};
  const next: NotificationsConfig = { ...current };
  delete next.whatsapp_number;
  next.enabled = false;

  const { error } = await admin
    .from("user_profiles")
    .update({
      notifications_config: next,
      whatsapp_verified_number: null,
      whatsapp_verified_at: null,
      whatsapp_pending_number: null,
      whatsapp_otp_hash: null,
      whatsapp_otp_expires_at: null,
      whatsapp_otp_attempts: 0,
    })
    .eq("id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings/notifications");
  return { ok: true };
}
