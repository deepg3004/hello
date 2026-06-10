// Admin · Notifications — delivery log for external sends (email / WhatsApp /
// SMS), from migration 090. Read-only oversight: did the receipt go out? did a
// WhatsApp fail? In-app (bell) notifications are NOT here — they live in the
// `notifications` table surfaced in the user feeds.

import {
  AdminNotificationsClient,
  type NotifLogRow,
} from "@/components/admin/AdminNotificationsClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

export const metadata = { title: "Admin · Notifications" };

export default async function AdminNotificationsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("notification_logs")
    .select("channel, event_key, recipient, subject, status, provider, error, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows: NotifLogRow[] = (data ?? []).map((r) => ({
    channel: (r.channel as NotifLogRow["channel"]) ?? "email",
    eventKey: (r.event_key as string | null) ?? null,
    recipient: (r.recipient as string) ?? "",
    subject: (r.subject as string | null) ?? null,
    status: (r.status as NotifLogRow["status"]) ?? "sent",
    provider: (r.provider as string | null) ?? null,
    error: (r.error as string | null) ?? null,
    createdAt: r.created_at as string,
  }));

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Notifications"
        blurb="Delivery log for the latest email, WhatsApp and SMS sends across the platform."
        resourcesHref={null}
      />
      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <AdminNotificationsClient rows={rows} />
      </div>
    </div>
  );
}
