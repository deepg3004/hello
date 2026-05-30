"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Download, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import {
  exportTransactionsCsvAction,
  refundOrderAction,
} from "@/actions/transactions";
import { formatINR, cn } from "@/lib/utils";

const PAGE_SIZE = 25;
const STATUSES = ["paid", "pending", "failed", "refunded", "cancelled"];

export interface TransactionRow {
  id: string;
  buyer_name: string | null;
  buyer_email: string;
  buyer_phone: string | null;
  buyer_address: Record<string, unknown> | null;
  amount: number;
  platform_commission: number;
  seller_amount: number;
  status: string;
  payment_gateway: string | null;
  gateway_payment_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  page_title: string | null;
  page_slug: string | null;
  created_at: string;
}

export interface PageOption {
  id: string;
  title: string;
}

interface TransactionsClientProps {
  rows: TransactionRow[];
  pages: PageOption[];
  initialFilter: {
    from: string;
    to: string;
    status: string;
    page_id: string;
    search: string;
  };
  isAdmin?: boolean;
}

const rupees = (n: number) => formatINR(n * 100);

export function TransactionsClient({
  rows,
  pages,
  initialFilter,
  isAdmin,
}: TransactionsClientProps) {
  const { toast } = useToast();
  const [filter, setFilter] = useState(initialFilter);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  // Filter client-side over the server-loaded snapshot.
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter.from && new Date(r.created_at) < new Date(filter.from)) return false;
      if (filter.to && new Date(r.created_at) > endOfDay(filter.to)) return false;
      if (filter.status && r.status !== filter.status) return false;
      if (filter.page_id && r.page_title) {
        const match = pages.find((p) => p.id === filter.page_id);
        if (!match || match.title !== r.page_title) return false;
      }
      if (filter.search) {
        const s = filter.search.toLowerCase();
        const inName = r.buyer_name?.toLowerCase().includes(s);
        const inEmail = r.buyer_email.toLowerCase().includes(s);
        if (!inName && !inEmail) return false;
      }
      return true;
    });
  }, [rows, filter, pages]);

  const totalRevenue = filtered.reduce((acc, r) => acc + Number(r.amount ?? 0), 0);
  const totalCommission = filtered.reduce(
    (acc, r) => acc + Number(r.platform_commission ?? 0),
    0,
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetFilters() {
    setFilter({ from: "", to: "", status: "", page_id: "", search: "" });
    setPage(1);
  }

  async function onExport() {
    setExporting(true);
    const result = await exportTransactionsCsvAction({
      from: filter.from || undefined,
      to: filter.to ? endOfDay(filter.to).toISOString() : undefined,
      status: filter.status || undefined,
      page_id: filter.page_id || undefined,
      search: filter.search || undefined,
    });
    setExporting(false);
    if (!result.ok || !result.csv) {
      toast({ title: "Export failed", description: result.message, variant: "destructive" });
      return;
    }
    triggerCsvDownload(result.csv, result.filename ?? "transactions.csv");
  }

  async function onRefund(orderId: string) {
    setRefundingId(orderId);
    const r = await refundOrderAction(orderId);
    setRefundingId(null);
    if (!r.ok) {
      toast({ title: "Refund failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Order marked refunded" });
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-6">
          <div className="md:col-span-2">
            <Label className="text-xs">Search buyer</Label>
            <Input
              value={filter.search}
              placeholder="Name or email"
              onChange={(e) => {
                setPage(1);
                setFilter((f) => ({ ...f, search: e.target.value }));
              }}
            />
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={filter.from}
              onChange={(e) => {
                setPage(1);
                setFilter((f) => ({ ...f, from: e.target.value }));
              }}
            />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={filter.to}
              onChange={(e) => {
                setPage(1);
                setFilter((f) => ({ ...f, to: e.target.value }));
              }}
            />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select
              value={filter.status || "all"}
              onValueChange={(v) => {
                setPage(1);
                setFilter((f) => ({ ...f, status: v === "all" ? "" : v }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Page</Label>
            <Select
              value={filter.page_id || "all"}
              onValueChange={(v) => {
                setPage(1);
                setFilter((f) => ({ ...f, page_id: v === "all" ? "" : v }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pages</SelectItem>
                {pages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2 md:col-span-6">
            <Button variant="outline" size="sm" onClick={resetFilters}>
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Reset
            </Button>
            <Button size="sm" onClick={onExport} disabled={exporting} className="ml-auto">
              {exporting ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-2 h-3.5 w-3.5" />
              )}
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Buyer</TableHead>
                <TableHead>Page</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">To seller</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No transactions match the current filter.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => {
                  const open = expandedId === row.id;
                  return (
                    <ExpandableRow
                      key={row.id}
                      row={row}
                      open={open}
                      onToggle={() => setExpandedId(open ? null : row.id)}
                      isAdmin={!!isAdmin}
                      onRefund={onRefund}
                      refunding={refundingId === row.id}
                    />
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
            <div className="text-muted-foreground">
              Showing <span className="font-medium text-foreground">{pageRows.length}</span> of{" "}
              <span className="font-medium text-foreground">{filtered.length}</span> ·{" "}
              Revenue <span className="font-mono text-foreground">{rupees(totalRevenue)}</span> ·{" "}
              Commission <span className="font-mono text-foreground">{rupees(totalCommission)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ExpandableRow({
  row,
  open,
  onToggle,
  isAdmin,
  onRefund,
  refunding,
}: {
  row: TransactionRow;
  open: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  onRefund: (id: string) => void;
  refunding: boolean;
}) {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell className="text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell>
          <div className="font-medium">{row.buyer_name ?? row.buyer_email}</div>
          {row.buyer_name && (
            <div className="text-xs text-muted-foreground">{row.buyer_email}</div>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground">{row.page_title ?? "—"}</TableCell>
        <TableCell className="text-right font-mono">{rupees(row.amount)}</TableCell>
        <TableCell className="text-right font-mono text-muted-foreground">
          {rupees(row.platform_commission)}
        </TableCell>
        <TableCell className="text-right font-mono">{rupees(row.seller_amount)}</TableCell>
        <TableCell>
          <StatusBadge status={row.status} />
        </TableCell>
        <TableCell className="text-muted-foreground">
          {format(new Date(row.created_at), "d MMM yyyy, HH:mm")}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="bg-muted/20">
          <TableCell colSpan={8} className="px-6 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <DetailBlock label="Buyer">
                <KV k="Name" v={row.buyer_name ?? "—"} />
                <KV k="Email" v={row.buyer_email} />
                <KV k="Phone" v={row.buyer_phone ?? "—"} />
                <KV k="Address" v={formatAddress(row.buyer_address)} />
              </DetailBlock>
              <DetailBlock label="Payment">
                <KV k="Gateway" v={row.payment_gateway ?? "—"} />
                <KV k="Payment ID" v={row.gateway_payment_id ?? "—"} mono />
                <KV k="UTM source" v={row.utm_source ?? "—"} />
                <KV k="UTM medium" v={row.utm_medium ?? "—"} />
                <KV k="UTM campaign" v={row.utm_campaign ?? "—"} />
              </DetailBlock>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                asChild
                disabled={!row.page_slug}
              >
                <a
                  href={row.page_slug ? `/p/${row.page_slug}` : "#"}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  View page
                </a>
              </Button>
              <Button
                size="sm"
                variant="outline"
                asChild
                disabled={row.status !== "paid"}
              >
                <a
                  href={row.status === "paid" ? `/api/orders/${row.id}/invoice` : "#"}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    if (row.status !== "paid") {
                      e.preventDefault();
                      return;
                    }
                    e.stopPropagation();
                  }}
                >
                  GST invoice (PDF)
                </a>
              </Button>
              {isAdmin && row.status === "paid" && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefund(row.id);
                  }}
                  disabled={refunding}
                >
                  {refunding && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Refund
                </Button>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <dl className="space-y-1">{children}</dl>
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn("text-right", mono && "font-mono text-xs")}>{v}</dd>
    </div>
  );
}

function formatAddress(addr: Record<string, unknown> | null): string {
  if (!addr) return "—";
  const parts = ["line1", "line2", "city", "state", "postal_code", "country"]
    .map((k) => (addr[k] as string | undefined)?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function endOfDay(iso: string): Date {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}

function triggerCsvDownload(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
