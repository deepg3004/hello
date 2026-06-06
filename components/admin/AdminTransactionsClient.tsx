"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  IndianRupee,
  Receipt,
  Search,
  ShoppingBag,
  TrendingUp,
  Undo2,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { OrderActionsMenu } from "@/components/admin/OrderActionsMenu";
import { cn, formatINR } from "@/lib/utils";

const rupees = (n: number) => formatINR(n * 100);
const STATUSES = ["paid", "pending", "failed", "refunded", "cancelled"];

export interface AdminTxnRow {
  id: string;
  buyer_email: string;
  amount: number;
  commission: number;
  status: string;
  payment_gateway: string | null;
  created_at: string;
  seller_user_id: string;
  seller_name: string;
  page_title: string | null;
}

export function AdminTransactionsClient({ rows }: { rows: AdminTxnRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  // Everything except the status filter — powers the chip counts.
  const base = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.buyer_email.toLowerCase().includes(s) ||
        r.seller_name.toLowerCase().includes(s) ||
        (r.page_title?.toLowerCase().includes(s) ?? false),
    );
  }, [rows, search]);

  const filtered = useMemo(
    () => (status ? base.filter((r) => r.status === status) : base),
    [base, status],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: base.length };
    for (const st of STATUSES) c[st] = 0;
    for (const r of base) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [base]);

  const summary = useMemo(() => {
    let gmv = 0;
    let commission = 0;
    let paidCount = 0;
    let refunded = 0;
    for (const r of filtered) {
      if (r.status === "paid") {
        gmv += r.amount;
        commission += r.commission;
        paidCount += 1;
      }
      if (r.status === "refunded" || r.status === "partially_refunded") {
        refunded += r.amount;
      }
    }
    return { gmv, commission, paidCount, refunded };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* ── Summary cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="GMV (paid)" value={rupees(summary.gmv)} tile="tile-indigo" icon={TrendingUp} />
        <MiniStat label="Commission" value={rupees(summary.commission)} tile="tile-emerald" icon={IndianRupee} />
        <MiniStat label="Paid Orders" value={summary.paidCount.toLocaleString("en-IN")} tile="tile-violet" icon={ShoppingBag} />
        <MiniStat label="Refunded" value={rupees(summary.refunded)} tile="tile-rose" icon={Undo2} />
      </div>

      {/* ── Search + status chips ─────────────────────────────────────── */}
      <div className="card-surface flex flex-col gap-3 p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder="Search buyer, seller or page…"
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip label="All" count={counts.all} active={!status} onClick={() => setStatus("")} />
          {STATUSES.map((s) => (
            <StatusChip
              key={s}
              label={s}
              count={counts[s] ?? 0}
              tone={s}
              active={status === s}
              onClick={() => setStatus(status === s ? "" : s)}
            />
          ))}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="card-surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="th-label">Buyer</TableHead>
              <TableHead className="th-label">Seller</TableHead>
              <TableHead className="th-label">Page</TableHead>
              <TableHead className="th-label text-right">Amount</TableHead>
              <TableHead className="th-label text-right">Commission</TableHead>
              <TableHead className="th-label">Gateway</TableHead>
              <TableHead className="th-label">Status</TableHead>
              <TableHead className="th-label">Date</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full tile-indigo">
                      <Receipt className="h-5 w-5" />
                    </div>
                    {rows.length === 0 ? "No transactions yet." : "No matches for these filters."}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} className="transition-colors hover:bg-muted/30">
                  <TableCell>{r.buyer_email}</TableCell>
                  <TableCell>
                    <Link href={`/admin/users/${r.seller_user_id}`} className="hover:underline">
                      {r.seller_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.page_title ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{rupees(r.amount)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {rupees(r.commission)}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {r.payment_gateway ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(r.created_at), "d MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <OrderActionsMenu orderId={r.id} status={r.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Showing {filtered.length.toLocaleString("en-IN")} of{" "}
        {rows.length.toLocaleString("en-IN")} orders (latest 500).
      </p>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function MiniStat({
  label,
  value,
  tile,
  icon: Icon,
}: {
  label: string;
  value: string;
  tile: string;
  icon: typeof IndianRupee;
}) {
  return (
    <div className="card-surface flex items-center gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-md">
      <span
        aria-hidden
        className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tile)}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="th-label truncate">{label}</p>
        <p className="mt-0.5 font-sora text-lg font-bold tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  );
}

const CHIP_ACTIVE: Record<string, string> = {
  all: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300",
  paid: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  pending: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  failed: "bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300",
  refunded: "bg-violet-500/15 text-violet-700 ring-violet-500/30 dark:text-violet-300",
  cancelled: "bg-zinc-400/15 text-muted-foreground ring-zinc-400/30 dark:text-zinc-300",
};

function StatusChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone?: string;
  onClick: () => void;
}) {
  const activeCls = CHIP_ACTIVE[tone ?? "all"] ?? CHIP_ACTIVE.all;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium capitalize ring-1 ring-inset transition",
        active
          ? activeCls
          : "border border-border bg-card text-muted-foreground ring-transparent hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
          active ? "bg-white/40 dark:bg-white/15" : "bg-muted",
        )}
      >
        {count.toLocaleString("en-IN")}
      </span>
    </button>
  );
}
