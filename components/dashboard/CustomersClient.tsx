"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatINR } from "@/lib/utils";

export interface CustomerOrder {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  page_title: string | null;
}

export interface Customer {
  email: string;
  name: string | null;
  phone: string | null;
  total_orders: number;
  total_spent: number;
  last_purchase_at: string;
  first_page_title: string | null;
  orders: CustomerOrder[];
}

const rupees = (n: number) => formatINR(n * 100);

const csvEscape = (s: unknown) => {
  const v = s == null ? "" : String(s);
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

export function CustomersClient({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.email.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q),
    );
  }, [search, customers]);

  function exportCsv() {
    const header = [
      "email",
      "name",
      "phone",
      "total_orders",
      "total_spent",
      "last_purchase_at",
      "first_page",
    ];
    const lines = [header.join(",")];
    for (const c of filtered) {
      lines.push(
        [c.email, c.name ?? "", c.phone ?? "", c.total_orders, c.total_spent, c.last_purchase_at, c.first_page_title ?? ""]
          .map(csvEscape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoxai-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email"
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} className="ml-auto">
              <Download className="mr-2 h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Total spent</TableHead>
                  <TableHead>Last purchase</TableHead>
                  <TableHead>First page</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No customers yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow
                      key={c.email}
                      className="cursor-pointer"
                      onClick={() => setActive(c)}
                    >
                      <TableCell>
                        <div className="font-medium">{c.name ?? c.email}</div>
                        {c.name && (
                          <div className="text-xs text-muted-foreground">{c.email}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.phone ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">{c.total_orders}</TableCell>
                      <TableCell className="text-right font-mono">
                        {rupees(c.total_spent)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(c.last_purchase_at), "d MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.first_page_title ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle>{active.name ?? active.email}</SheetTitle>
                <SheetDescription>{active.email}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Total spent</p>
                  <p className="mt-1 text-lg font-semibold">{rupees(active.total_spent)}</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Orders</p>
                  <p className="mt-1 text-lg font-semibold">{active.total_orders}</p>
                </div>
              </div>
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold">Order history</h3>
                <ul className="space-y-2">
                  {active.orders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                      <div>
                        <div className="font-medium">{o.page_title ?? "Order"}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(o.created_at), "d MMM yyyy, HH:mm")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={o.status} />
                        <span className="font-mono text-sm">{rupees(o.amount)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
