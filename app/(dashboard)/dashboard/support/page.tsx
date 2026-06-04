// /dashboard/support — Help & Support (Session 17). Sellers open tickets and
// see their thread; admins reply from /admin/support. In-house (no third party).

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  SupportClient,
  type SupportTicket,
} from "@/components/dashboard/support/SupportClient";

export const metadata = { title: "Help & Support" };

export default async function SupportPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/support");

  const admin = createAdminClient();
  const { data } = await admin
    .from("support_tickets")
    .select("id, subject, status, last_message_at, created_at")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(100);

  const tickets: SupportTicket[] = (data ?? []).map((t) => ({
    id: t.id as string,
    subject: t.subject as string,
    status: t.status as string,
    lastMessageAt: t.last_message_at as string,
  }));

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Help & Support"
        blurb="Open a ticket and our team will get back to you by email and here."
        gradient="from-sky-600 via-cyan-600 to-teal-600"
        resourcesHref={null}
      />
      <SupportClient tickets={tickets} />
    </div>
  );
}
