import Link from "next/link";
import { format } from "date-fns";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RevenueBars } from "@/components/dashboard/RevenueBars";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getDashboardMetrics,
  getRecentTransactions,
  getTopPages,
} from "@/lib/dashboard/queries";
import { createClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/utils";

export const metadata = {
  title: "Overview",
};

function rupees(n: number) {
  return formatINR(n * 100);
}

export default async function DashboardOverview() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [metrics, recent, topPages] = await Promise.all([
    getDashboardMetrics(user.id),
    getRecentTransactions(user.id, 10),
    getTopPages(user.id, 5),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Your store this month.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <MetricCard label="Revenue this month" value={rupees(metrics.revenueThisMonth)} />
        <MetricCard label="Pending payout" value={rupees(metrics.pendingPayout)} hint="Paid orders not yet paid out" />
        <MetricCard label="Customers" value={metrics.totalCustomers.toLocaleString("en-IN")} />
        <MetricCard label="Active pages" value={metrics.activePages.toLocaleString("en-IN")} />
        <MetricCard label="Failed payments" value={metrics.failedPayments.toLocaleString("en-IN")} />
        <MetricCard label="Commission paid" value={rupees(metrics.commissionPaid)} hint="Platform's cut" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent transactions</CardTitle>
            <Link
              href="/dashboard/transactions"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {recent.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                No transactions yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.buyer_name ?? row.buyer_email}</div>
                        {row.buyer_name && (
                          <div className="text-xs text-muted-foreground">{row.buyer_email}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.page_title ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {rupees(row.amount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(row.created_at), "d MMM, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top pages by revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueBars rows={topPages} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
