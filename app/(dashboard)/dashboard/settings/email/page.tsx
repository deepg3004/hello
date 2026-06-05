// /dashboard/settings/email — Email Integrations (Session 14). Connect your own
// SMTP so buyer-facing emails (receipts, lead + booking confirmations) send from
// your domain. Falls back to the platform mailbox when unset/inactive.

import { redirect } from "next/navigation";

import { requirePageActor } from "@/lib/account-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  SellerSmtpForm,
  type SmtpState,
} from "@/components/dashboard/email/SellerSmtpForm";

export const metadata = { title: "Email Integrations" };

export default async function EmailIntegrationsPage() {
  const ctx = await requirePageActor("email.view", "/dashboard/settings/email");

  const admin = createAdminClient();
  const { data } = await admin
    .from("seller_smtp")
    .select("host, port, secure, username, from_name, from_email, reply_to, active, password_enc, sending_domain")
    .eq("user_id", ctx.ownerId)
    .maybeSingle();

  const initial: SmtpState | null = data
    ? {
        host: data.host,
        port: Number(data.port ?? 587),
        secure: !!data.secure,
        username: data.username,
        from_name: data.from_name,
        from_email: data.from_email,
        reply_to: data.reply_to,
        active: data.active,
        configured: !!data.password_enc,
        sending_domain: (data as { sending_domain?: string | null }).sending_domain ?? null,
      }
    : null;

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Email Integrations"
        blurb="Send buyer emails from your own domain via custom SMTP. We fall back to the platform mailbox when this is off."
        gradient="from-blue-600 via-sky-600 to-cyan-600"
        resourcesHref={null}
      />
      <SellerSmtpForm initial={initial} />
    </div>
  );
}
