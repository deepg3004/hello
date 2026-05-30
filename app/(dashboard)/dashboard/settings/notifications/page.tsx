import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_EVENT_TOGGLES,
  EVENTS,
  type NotificationsConfig,
} from "@/lib/notifications-config";
import { NotificationsSettingsForm } from "@/components/dashboard/NotificationsSettingsForm";

export const metadata = { title: "Notifications · Settings" };

export default async function NotificationsSettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select(
      "notifications_config, whatsapp_verified_number, whatsapp_verified_at, whatsapp_pending_number, whatsapp_otp_expires_at, phone",
    )
    .eq("id", user.id)
    .single();

  const cfg = (profile?.notifications_config as NotificationsConfig | null) ?? {};
  const events = { ...DEFAULT_EVENT_TOGGLES, ...(cfg.events ?? {}) };
  const email = { ...DEFAULT_EVENT_TOGGLES, ...(cfg.email ?? {}) };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">
          WhatsApp &amp; email notifications
        </h1>
        <p className="text-sm text-muted-foreground">
          Get a ping on your phone the moment something important happens — a
          sale, a lead, a payout. WhatsApp uses MSG91 templates. Email always
          goes out via Resend.
        </p>
      </div>

      <NotificationsSettingsForm
        initialEnabled={cfg.enabled ?? false}
        initialEvents={events}
        initialEmailEvents={email}
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
