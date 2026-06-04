"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowDownToLine, ArrowUpFromLine, IndianRupee, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatINR } from "@/lib/utils";

export interface AdminRevenueRow {
  id: string;
  type: "debit" | "credit";
  amountPaise: number;
  orderId: string | null;
  description: string | null;
  balanceAfterPaise: number;
  createdAt: string;
  sellerUserId: string;
  sellerName: string;
}

const TYPES = ["debit", "credit"] as const;

export function AdminRevenueClient({ rows }: { rows: AdminRevenueRow[] }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | "debit" | "credit">("");

  const base = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.sellerName.toLowerCase().includes(s) ||
        (r.description?.toLowerCase().includes(s) ?? false),
    );
  }, [rows, search]);

  const filtered = useMemo(
    () => (type ? base.filter((r) => r.type === type) : base),
    [base, type],
  );

  const summary = useMemo(() => {
    let fees = 0;
    let recharged = 0;
    for (const r of filtered) {
      if (r.type === "debit") fees += r.amountPaise;
      else recharged += r.amountPaise;
    }
    return { fees, recharged };
  }, [filtered]);

  const counts = useMemo(() => {
    const c = { all: base.length, debit: 0, credit: 0 };
    for (const r of base) c[r.type] += 1;
    return c;
  }, [base]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MiniStat label="Fees earned (revenue)" value={formatINR(summary.fees)} tile="tile-emerald" icon={IndianRupee} />
        <MiniStat label="Recharged (cash in)" value={formatINR(summary.recharged)} tile="tile-indigo" icon={ArrowDownToLine} />
        <MiniStat label="Movements" value={filtered.length.toLocaleString("en-IN")} tile="tile-violet" icon={ArrowUpFromLine} />
      </div>

      <div className="card-surface flex flex-col gap-3 p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder="Search seller or description…"
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip label="All" count={counts.all} active={!type} onClick={() => setType("")} />
          {TYPES.map((t) => (
            <Chip
              key={t}
              label={t === "debit" ? "Fees (debit)" : "Recharge (credit)"}
              count={counts[t]}
              active={type === t}
              onClick={() => setType(type === t ? "" : t)}
            />
          ))}
        </div>
      </div>

      <div className="card-surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="th-label">Seller</TableHead>
              <TableHead className="th-label">Type</TableHead>
              <TableHead className="th-label">Description</TableHead>
              <TableHead className="th-label text-right">Amount</TableHead>
              <TableHead className="th-label text-right">Balance after</TableHead>
              <TableHead className="th-label">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No wallet movements yet." : "No matches."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} className="transition-colors hover:bg-muted/30">
                  <TableCell>
                    <Link href={`/admin/users/${r.sellerUserId}`} className="hover:underline">
                      {r.sellerName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                        r.type === "debit"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
                      )}
                    >
                      {r.type === "debit" ? "Fee" : "Recharge"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.description ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{formatINR(r.amountPaise)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatINR(r.balanceAfterPaise)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(r.createdAt), "d MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Showing {filtered.length.toLocaleString("en-IN")} of{" "}
        {rows.length.toLocaleString("en-IN")} movements (latest 2k).
      </p>
    </div>
  );
}

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
      <span aria-hidden className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tile)}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="th-label truncate">{label}</p>
        <p className="mt-0.5 font-sora text-lg font-bold tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition",
        active
          ? "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300"
          : "border border-border bg-card text-muted-foreground ring-transparent hover:text-foreground",
      )}
    >
      {label}
      <span className={cn("rounded-full px-1.5 text-[10px] font-semibold tabular-nums", active ? "bg-white/40 dark:bg-white/15" : "bg-muted")}>
        {count.toLocaleString("en-IN")}
      </span>
    </button>
  );
}
