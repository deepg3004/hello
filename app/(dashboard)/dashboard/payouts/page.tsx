import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RequestPayoutDialog } from "@/components/dashboard/RequestPayoutDialog";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Payouts" };

const rupees = (n: number) => formatINR(n * 100);

export default async function PayoutsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [{ data: profile }, { data: paidOrders }, { data: payouts }] = await Promise.all([
    admin
      .from("user_profiles")
      .select("kyc_level, bank_verified, payouts_enabled")
      .eq("id", user.id)
      .single(),
    admin
      .from("orders")
      .select("seller_amount")
      .eq("seller_user_id", user.id)
      .eq("status", "paid"),
    admin
      .from("payouts")
      .select("id, amount, status, gateway, bank_account, initiated_at, completed_at, failure_reason")
      .eq("user_id", user.id)
      .order("initiated_at", { ascending: false })
      .limit(100),
  ]);

  const gross = (paidOrders ?? []).reduce((acc, r) => acc + Number(r.seller_amount ?? 0), 0);
  const reserved = (payouts ?? [])
    .filter((p) => ["queued", "processing", "completed"].includes(p.status))
    .reduce((acc, p) => acc + Number(p.amount ?? 0), 0);
  const available = Math.max(0, gross - reserved);

  const kycComplete = !!profile?.bank_verified && (profile?.kyc_level ?? 0) >= 2;
  const totalPaid = (payouts ?? [])
    .filter((p) => p.status === "completed")
    .reduce((acc, p) => acc + Number(p.amount ?? 0), 0);
  const inFlight = (payouts ?? [])
    .filter((p) => p.status === "queued" || p.status === "processing")
    .reduce((acc, p) => acc + Number(p.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payouts</h1>
          <p className="text-sm text-muted-foreground">
            Your share of every paid order, minus what you&apos;ve already withdrawn.
          </p>
        </div>
        {kycComplete && <RequestPayoutDialog available={available} />}
      </div>

      {!kycComplete && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Complete KYC to enable payouts</p>
            <p className="mt-1">
              We can&apos;t send you money until your bank account is verified.{" "}
              <Link href="/dashboard/settings" className="underline">
                Finish KYC
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Available" value={rupees(available)} hint="Ready to withdraw" />
        <MetricCard label="In flight" value={rupees(inFlight)} hint="Queued / processing" />
        <MetricCard label="Total paid out" value={rupees(totalPaid)} hint="All-time" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payout history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {(payouts ?? []).length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No payouts yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bank · last 4</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Settled</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payouts ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-right font-mono">
                      {rupees(Number(p.amount ?? 0))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      ••{p.bank_account ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(p.initiated_at), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.completed_at
                        ? format(new Date(p.completed_at), "d MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.failure_reason ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
