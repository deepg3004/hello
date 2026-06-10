import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePageActor } from "@/lib/account-context";
import {
  DEFAULT_EVENT_TOGGLES,
  DEFAULT_SMS_TOGGLES,
  EVENTS,
  type NotificationsConfig,
} from "@/lib/notifications-config";
import { NotificationsSettingsForm } from "@/components/dashboard/NotificationsSettingsForm";

export const metadata = { title: "Notifications · Settings" };

export default async function NotificationsSettingsPage() {
  const ctx = await requirePageActor("notifications.view", "/dashboard/settings/notifications");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select(
      "notifications_config, whatsapp_verified_number, whatsapp_verified_at, whatsapp_pending_number, whatsapp_otp_expires_at, phone",
    )
    .eq("id", ctx.ownerId)
    .single();

  const cfg = (profile?.notifications_config as NotificationsConfig | null) ?? {};
  const events = { ...DEFAULT_EVENT_TOGGLES, ...(cfg.events ?? {}) };
  const email = { ...DEFAULT_EVENT_TOGGLES, ...(cfg.email ?? {}) };
  const inapp = { ...DEFAULT_EVENT_TOGGLES, ...(cfg.inapp ?? {}) };
  const sms = { ...DEFAULT_SMS_TOGGLES, ...(cfg.sms ?? {}) };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">
          Notifications
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose exactly how you hear about sales, leads and payouts — the
          in-app bell, email, WhatsApp, or SMS. Pick a channel per event below.
        </p>
      </div>

      <NotificationsSettingsForm
        initialEnabled={cfg.enabled ?? false}
        initialEvents={events}
        initialEmailEvents={email}
        initialInappEvents={inapp}
        initialSmsEvents={sms}
        verifiedNumber={profile?.whatsapp_verified_number ?? null}
        verifiedAt={profile?.whatsapp_verified_at ?? null}
        pendingNumber={profile?.whatsapp_pending_number ?? null}
        pendingExpiresAt={profile?.whatsapp_otp_expires_at ?? null}
        defaultPhone={profile?.phone ?? null}
        eventCatalog={EVENTS}
      />
    </div>
  );
}
