"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Banknote, Search } from "lucide-react";

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
import { PayoutActionsMenu } from "@/components/admin/PayoutActionsMenu";
import { cn, formatINR } from "@/lib/utils";

const rupees = (n: number) => formatINR(n * 100);

export interface AdminPayoutRow {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  bank_account: string | null;
  initiated_at: string;
  completed_at: string | null;
  failure_reason: string | null;
  seller_name: string | null;
  seller_email: string | null;
}

export function AdminPayoutsClient({ rows }: { rows: AdminPayoutRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  // Distinct statuses present in the data, in first-seen order.
  const statuses = useMemo(() => {
    const seen: string[] = [];
    for (const r of rows) if (!seen.includes(r.status)) seen.push(r.status);
    return seen;
  }, [rows]);

  // Everything except the status filter — powers the chip counts.
  const base = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        (r.seller_name?.toLowerCase().includes(s) ?? false) ||
        (r.seller_email?.toLowerCase().includes(s) ?? false) ||
        rupees(Number(r.amount ?? 0)).toLowerCase().includes(s) ||
        String(r.amount ?? "").includes(s),
    );
  }, [rows, search]);

  const filtered = useMemo(
    () => (status ? base.filter((r) => r.status === status) : base),
    [base, status],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: base.length };
    for (const st of statuses) c[st] = 0;
    for (const r of base) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [base, statuses]);

  return (
    <div className="space-y-4">
      {/* ── Search + status chips ─────────────────────────────────────── */}
      <div className="card-surface flex flex-col gap-3 p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder="Search seller name, email or amount…"
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip label="All" count={counts.all} active={!status} onClick={() => setStatus("")} />
          {statuses.map((s) => (
            <StatusChip
              key={s}
              label={s.replace(/_/g, " ")}
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
              <TableHead className="th-label">Seller</TableHead>
              <TableHead className="th-label text-right">Amount</TableHead>
              <TableHead className="th-label">Status</TableHead>
              <TableHead className="th-label">Bank · last 4</TableHead>
              <TableHead className="th-label">Requested</TableHead>
              <TableHead className="th-label">Settled</TableHead>
              <TableHead className="th-label">Notes</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full tile-emerald">
                      <Banknote className="h-5 w-5" />
                    </div>
                    {rows.length === 0 ? "No payout requests yet." : "No matches for these filters."}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} className="transition-colors hover:bg-muted/30">
                  <TableCell>
                    <Link href={`/admin/users/${r.user_id}`} className="hover:underline">
                      {r.seller_name ?? r.seller_email ?? "—"}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Showing {filtered.length.toLocaleString("en-IN")} of{" "}
        {rows.length.toLocaleString("en-IN")} payouts (latest 500).
      </p>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

const CHIP_ACTIVE: Record<string, string> = {
  all: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300",
  completed: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  paid: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  queued: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  pending: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  processing: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300",
  failed: "bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300",
  rejected: "bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300",
  cancelled: "bg-zinc-400/15 text-zinc-700 ring-zinc-400/30 dark:text-zinc-300",
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
