import Link from "next/link";
import { format } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { PayoutActionsMenu } from "@/components/admin/PayoutActionsMenu";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Admin · Payouts" };

const rupees = (n: number) => formatINR(n * 100);

export default async function AdminPayoutsPage() {
  const admin = createAdminClient();
  const { data: rowsRaw } = await admin
    .from("payouts")
    .select(
      "id, user_id, amount, status, gateway, bank_account, initiated_at, completed_at, failure_reason, user_profiles(full_name, email)",
    )
    .order("initiated_at", { ascending: false })
    .limit(500);

  const rows = (rowsRaw ?? []) as unknown as Array<{
    id: string;
    user_id: string;
    amount: number;
    status: string;
    gateway: string | null;
    bank_account: string | null;
    initiated_at: string;
    completed_at: string | null;
    failure_reason: string | null;
    user_profiles: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  }>;

  const queued = rows.filter((r) => r.status === "queued").reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const processing = rows.filter((r) => r.status === "processing").reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const paid = rows.filter((r) => r.status === "completed").reduce((a, r) => a + Number(r.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Every payout request across the platform.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <MetricCard label="Queued" value={rupees(queued)} />
        <MetricCard label="Processing" value={rupees(processing)} />
        <MetricCard label="Paid out" value={rupees(paid)} />
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bank · last 4</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Settled</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No payout requests yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const seller = Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link href={`/admin/users/${r.user_id}`} className="hover:underline">
                          {seller?.full_name ?? seller?.email ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono">{rupees(Number(r.amount ?? 0))}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        ••{r.bank_account ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(r.initiated_at), "d MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.completed_at ? format(new Date(r.completed_at), "d MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.failure_reason ?? "—"}
                      </TableCell>
                      <TableCell>
                        {(r.status === "pending" || r.status === "processing") && (
                          <PayoutActionsMenu payoutId={r.id} status={r.status} />
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
