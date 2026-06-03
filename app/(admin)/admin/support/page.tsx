import { Mail } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AdminSupportClient,
  type AdminTicketRow,
} from "@/components/admin/AdminSupportClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

export const metadata = { title: "Admin · Support" };

interface TicketRow {
  id: string;
  subject: string;
  from_email: string;
  from_name: string | null;
  status: string;
  last_message_at: string;
  created_at: string;
  user_id: string | null;
  user_profiles:
    | { full_name: string | null; email: string }
    | { full_name: string | null; email: string }[]
    | null;
}

export default async function AdminSupportPage() {
  const admin = createAdminClient();
  // support_tickets has 2 FKs to user_profiles (user_id + assigned_admin_id) —
  // disambiguate so PostgREST follows the buyer/seller, not the assigned admin.
  const { data } = await admin
    .from("support_tickets")
    .select(
      "id, subject, from_email, from_name, status, last_message_at, created_at, user_id, user_profiles!support_tickets_user_id_fkey(full_name, email)",
    )
    .order("last_message_at", { ascending: false })
    .limit(200);

  const tickets = (data ?? []) as unknown as TicketRow[];

  const open = tickets.filter((t) => t.status === "open").length;
  const inProgress = tickets.filter((t) => t.status === "in_progress").length;

  const rows: AdminTicketRow[] = tickets.map((t) => {
    const linked = Array.isArray(t.user_profiles)
      ? t.user_profiles[0]
      : t.user_profiles;
    return {
      id: t.id,
      subject: t.subject,
      from_email: t.from_email,
      from_name: t.from_name,
      status: t.status,
      last_message_at: t.last_message_at,
      user_id: t.user_id,
      linked_name: linked?.full_name ?? null,
      linked_email: linked?.email ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <DashboardHero
          title="Support"
          blurb={`Tickets from support@invoxai.io. Open: ${open} · In progress: ${inProgress}`}
          resourcesHref={null}
        />
      </div>

      <Card className="animate-in-up" style={{ animationDelay: "60ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl tile-indigo">
              <Mail className="h-4 w-4" />
            </span>
            Gmail integration
          </CardTitle>
          <CardDescription>
            The Gmail pull/send loop is configured separately. Once wired, new
            messages to <code>support@invoxai.io</code> auto-create tickets and
            replies from this UI send via Gmail.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          Not yet configured. Tickets shown below are whatever lives in{" "}
          <code>support_tickets</code>.
        </CardContent>
      </Card>

      <div className="animate-in-up" style={{ animationDelay: "120ms" }}>
        <AdminSupportClient rows={rows} />
      </div>
    </div>
  );
}
