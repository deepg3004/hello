import Link from "next/link";
import { format } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Admin · Audit Logs" };

interface AuditRow {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  user_profiles: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
}

export default async function AdminAuditLogsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_audit_logs")
    .select(
      "id, admin_id, action, target_type, target_id, details, ip_address, created_at, user_profiles(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as unknown as AuditRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-sora font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Every admin action is recorded here.
        </p>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No actions logged yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const adminP = Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(new Date(r.created_at), "d MMM yyyy, HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        {r.admin_id ? (
                          <Link href={`/admin/users/${r.admin_id}`} className="hover:underline">
                            {adminP?.full_name ?? adminP?.email ?? r.admin_id.slice(0, 8)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {r.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.target_type && (
                          <span>
                            {r.target_type}
                            {r.target_id ? ` · ${r.target_id.slice(0, 8)}` : ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {r.ip_address ?? "—"}
                      </TableCell>
                      <TableCell>
                        {r.details ? (
                          <code className="text-xs text-muted-foreground">
                            {JSON.stringify(r.details).slice(0, 60)}
                          </code>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
