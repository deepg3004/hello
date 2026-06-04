"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { IndianRupee, Search, ShoppingBag, Users } from "lucide-react";

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

const rupees = (n: number) => formatINR(n * 100);

export interface AdminCustomerRow {
  email: string;
  name: string | null;
  phone: string | null;
  orders: number;
  paidOrders: number;
  totalPaid: number;
  sellerCount: number;
  lastOrderAt: string;
}

export function AdminCustomersClient({ rows }: { rows: AdminCustomerRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.email.includes(s) ||
        (r.name?.toLowerCase().includes(s) ?? false) ||
        (r.phone?.includes(s) ?? false),
    );
  }, [rows, search]);

  const summary = useMemo(() => {
    let revenue = 0;
    for (const r of filtered) revenue += r.totalPaid;
    return { customers: filtered.length, revenue };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MiniStat label="Customers" value={summary.customers.toLocaleString("en-IN")} tile="tile-indigo" icon={Users} />
        <MiniStat label="Lifetime paid" value={rupees(summary.revenue)} tile="tile-emerald" icon={IndianRupee} />
        <MiniStat label="Total (unfiltered)" value={rows.length.toLocaleString("en-IN")} tile="tile-violet" icon={ShoppingBag} />
      </div>

      <div className="card-surface p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder="Search email, name or phone…"
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="card-surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="th-label">Customer</TableHead>
              <TableHead className="th-label">Phone</TableHead>
              <TableHead className="th-label text-right">Orders</TableHead>
              <TableHead className="th-label text-right">Paid</TableHead>
              <TableHead className="th-label text-right">Lifetime</TableHead>
              <TableHead className="th-label text-right">Sellers</TableHead>
              <TableHead className="th-label">Last order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full tile-indigo">
                      <Users className="h-5 w-5" />
                    </div>
                    {rows.length === 0 ? "No customers yet." : "No matches."}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.email} className="transition-colors hover:bg-muted/30">
                  <TableCell>
                    <div className="font-medium">{r.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.phone ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.orders}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.paidOrders}</TableCell>
                  <TableCell className="text-right font-mono">{rupees(r.totalPaid)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.sellerCount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(r.lastOrderAt), "d MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Showing {filtered.length.toLocaleString("en-IN")} of{" "}
        {rows.length.toLocaleString("en-IN")} customers.
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
  icon: typeof Users;
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
