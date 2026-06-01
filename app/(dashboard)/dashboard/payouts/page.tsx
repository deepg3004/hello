import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { MetricCard } from "@/components/dashboard/MetricCard";
import { RequestPayoutDialog } from "@/components/dashboard/RequestPayoutDialog";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, formatINR } from "@/lib/utils";

export const metadata = { title: "Payouts" };

const rupees = (n: number) => formatINR(n * 100);

export default async function PayoutsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [{ data: profile }, { data: paidOrders }, { data: payouts }] =
    await Promise.all([
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
        .select(
          "id, amount, status, gateway, bank_account, initiated_at, completed_at, failure_reason",
        )
        .eq("user_id", user.id)
        .order("initiated_at", { ascending: false })
        .limit(100),
    ]);

  const gross = (paidOrders ?? []).reduce(
    (acc, r) => acc + Number(r.seller_amount ?? 0),
    0,
  );
  const reserved = (payouts ?? [])
    .filter((p) => ["queued", "processing", "completed"].includes(p.status))
    .reduce((acc, p) => acc + Number(p.amount ?? 0), 0);
  const available = Math.max(0, gross - reserved);

  const kycComplete =
    !!profile?.bank_verified && (profile?.kyc_level ?? 0) >= 2;
  const totalPaid = (payouts ?? [])
    .filter((p) => p.status === "completed")
    .reduce((acc, p) => acc + Number(p.amount ?? 0), 0);
  const inFlight = (payouts ?? [])
    .filter((p) => p.status === "queued" || p.status === "processing")
    .reduce((acc, p) => acc + Number(p.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 animate-in-up"
        style={{ animationDelay: "0ms" }}
      >
        <div>
          <h1 className="page-title">Payouts</h1>
          <p className="page-subtitle">
            Your share of every paid order, minus what you&apos;ve already
            withdrawn.
          </p>
        </div>
        {kycComplete && <RequestPayoutDialog available={available} />}
      </div>

      {/* ── KYC-incomplete banner (full-width, amber) ────────────────── */}
      {!kycComplete && (
        <div
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 animate-in-up"
          style={{ animationDelay: "50ms" }}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">
              Complete KYC to enable payouts
            </p>
            <p className="mt-1">
              We can&apos;t send money until your bank account is verified
              against your PAN. The KYC flow is fully automated — usually
              takes 2 minutes.
            </p>
          </div>
          <Link
            href="/dashboard/kyc"
            className="self-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Finish KYC
            </span>
          </Link>
        </div>
      )}

      {/* ── 3 metric cards ───────────────────────────────────────────── */}
      <div
        className="grid grid-cols-1 gap-4 animate-in-up sm:grid-cols-3"
        style={{ animationDelay: "100ms" }}
      >
        <MetricCard
          label="Available balance"
          value={rupees(available)}
          icon={Wallet}
          accentColor="indigo"
          hint="Ready to withdraw"
        />
        <MetricCard
          label="Pending clearance"
          value={rupees(inFlight)}
          icon={Clock}
          accentColor="amber"
          hint="Queued or processing"
        />
        <MetricCard
          label="Total paid out"
          value={rupees(totalPaid)}
          icon={CheckCircle2}
          accentColor="emerald"
          hint="All-time settled"
        />
      </div>

      {/* ── Payout history table ─────────────────────────────────────── */}
      <div
        className="card-surface overflow-hidden animate-in-up"
        style={{ animationDelay: "200ms" }}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="section-title">Payout history</h2>
          <span className="text-xs text-muted-foreground">
            Showing last {Math.min((payouts ?? []).length, 100)} payouts
          </span>
        </div>

        {(payouts ?? []).length === 0 ? (
          <EmptyPayouts kycComplete={kycComplete} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <Th className="text-right">Amount</Th>
                  <Th>Status</Th>
                  <Th>Bank · last 4</Th>
                  <Th>Requested</Th>
                  <Th>Settled</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(payouts ?? []).map((p) => (
                  <tr
                    key={p.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-foreground">
                      {rupees(Number(p.amount ?? 0))}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      ••{p.bank_account ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(p.initiated_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.completed_at ? formatDate(p.completed_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.failure_reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn("th-label px-4 py-3", className)}
    >
      {children}
    </th>
  );
}

function EmptyPayouts({ kycComplete }: { kycComplete: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100/60 ring-1 ring-inset ring-indigo-200/70">
        <Inbox className="h-5 w-5 text-indigo-600" />
      </div>
      <div>
        <p className="font-medium text-foreground">No payouts yet</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {kycComplete
            ? "Once you have orders, request your first payout from the button above."
            : "Finish KYC to unlock payouts."}
        </p>
      </div>
    </div>
  );
}
