import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TelegramMembershipActions } from "@/components/admin/TelegramMembershipActions";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Admin · Telegram" };

interface MemRow {
  id: string;
  telegram_user_id: string | null;
  buyer_email: string;
  status: string;
  invited_at: string | null;
  joined_at: string | null;
  expires_at: string | null;
  telegram_group_id: string;
  telegram_vip_groups: { group_name: string | null; group_id: string; user_id: string } | { group_name: string | null; group_id: string; user_id: string }[] | null;
}

export default async function AdminTelegramPage() {
  const admin = createAdminClient();
  const { data: memsRaw } = await admin
    .from("telegram_memberships")
    .select(
      "id, telegram_user_id, buyer_email, status, invited_at, joined_at, expires_at, telegram_group_id, telegram_vip_groups(group_name, group_id, user_id)",
    )
    .order("invited_at", { ascending: false })
    .limit(500);

  const mems = (memsRaw ?? []) as unknown as MemRow[];

  const active = mems.filter((m) => m.status === "active").length;
  const invited = mems.filter((m) => m.status === "invited").length;
  const expired = mems.filter((m) => m.status === "expired").length;
  const removed = mems.filter((m) => m.status === "removed").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Telegram VIP memberships</h1>
        <p className="text-sm text-muted-foreground">
          Every paid invite, join, expiry and removal across every seller&apos;s VIP group.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Active" value={active.toLocaleString("en-IN")} />
        <MetricCard label="Invited" value={invited.toLocaleString("en-IN")} hint="Awaiting join" />
        <MetricCard label="Expired" value={expired.toLocaleString("en-IN")} />
        <MetricCard label="Removed" value={removed.toLocaleString("en-IN")} />
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {mems.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No memberships yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {mems.map((m) => {
                  const group = Array.isArray(m.telegram_vip_groups)
                    ? m.telegram_vip_groups[0]
                    : m.telegram_vip_groups;
                  const expiresAt = m.expires_at ? new Date(m.expires_at) : null;
                  const isFuture = expiresAt ? expiresAt > new Date() : false;
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-medium">{m.buyer_email}</div>
                        {m.telegram_user_id && (
                          <div className="font-mono text-xs text-muted-foreground">
                            tg:{m.telegram_user_id}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{group?.group_name ?? "—"}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {group?.group_id ?? ""}
                        </div>
                        {group?.user_id && (
                          <Link
                            href={`/admin/users/${group.user_id}`}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            Owner
                          </Link>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={m.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.joined_at ? format(new Date(m.joined_at), "d MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        {expiresAt ? (
                          <div>
                            <div>{format(expiresAt, "d MMM yyyy")}</div>
                            <div className="text-xs text-muted-foreground">
                              {isFuture
                                ? `in ${formatDistanceToNow(expiresAt)}`
                                : `${formatDistanceToNow(expiresAt)} ago`}
                            </div>
                          </div>
                        ) : (
                          <Badge variant="outline">Lifetime</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {(m.status === "active" || m.status === "invited") && (
                          <TelegramMembershipActions membershipId={m.id} />
                        )}
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
