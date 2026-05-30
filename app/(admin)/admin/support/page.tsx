import Link from "next/link";
import { format } from "date-fns";
import { Mail } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { createAdminClient } from "@/lib/supabase/admin";

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
  user_profiles: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
        <p className="text-sm text-muted-foreground">
          Tickets from support@invoxai.io. Open: {open} · In progress: {inProgress}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gmail integration</CardTitle>
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

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {tickets.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No tickets yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Linked user</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => {
                  const linked = Array.isArray(t.user_profiles)
                    ? t.user_profiles[0]
                    : t.user_profiles;
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="font-medium">{t.subject || "(no subject)"}</div>
                        <div className="text-xs text-muted-foreground">#{t.id.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{t.from_name ?? t.from_email}</div>
                        {t.from_name && (
                          <div className="text-xs text-muted-foreground">{t.from_email}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.user_id ? (
                          <Link href={`/admin/users/${t.user_id}`} className="hover:underline">
                            {linked?.full_name ?? linked?.email ?? "—"}
                          </Link>
                        ) : (
                          <Badge variant="outline">Unlinked</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(t.last_message_at), "d MMM yyyy, HH:mm")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
