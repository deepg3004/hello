"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Inbox,
  Loader2,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import {
  exportTransactionsCsvAction,
  refundOrderAction,
} from "@/actions/transactions";
import { cn, formatDateTime, formatINR, truncate } from "@/lib/utils";

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
  coupon_code: string | null;
  discount_amount: number;
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

// Stable initials hash from email so the same buyer renders consistently.
function buyerInitials(name: string | null, email: string): string {
  const src = name?.trim() || email;
  return src
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// Five-stop avatar gradient picked by hashing the email.
const AVATAR_GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-sky-500 to-blue-600",
] as const;

function gradientFor(email: string): string {
  let h = 2166136261;
  for (let i = 0; i < email.length; i++) {
    h ^= email.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length]!;
}

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

  // Client-side filter over the server-loaded snapshot.
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

  const anyFilterActive =
    !!filter.from ||
    !!filter.to ||
    !!filter.status ||
    !!filter.page_id ||
    !!filter.search;

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
      toast({
        title: "Export failed",
        description: result.message,
        variant: "destructive",
      });
      return;
    }
    triggerCsvDownload(result.csv, result.filename ?? "transactions.csv");
  }

  async function onRefund(orderId: string) {
    setRefundingId(orderId);
    const r = await refundOrderAction(orderId);
    setRefundingId(null);
    if (!r.ok) {
      toast({
        title: "Refund failed",
        description: r.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Order marked refunded" });
  }

  const fromX = Math.min((page - 1) * PAGE_SIZE + 1, filtered.length);
  const toX = Math.min(page * PAGE_SIZE, filtered.length);

  return (
    <div className="space-y-4">
      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {/* From */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              From
            </Label>
            <Input
              type="date"
              value={filter.from}
              onChange={(e) => {
                setPage(1);
                setFilter((f) => ({ ...f, from: e.target.value }));
              }}
              className="w-[150px]"
            />
          </div>
          {/* To */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              To
            </Label>
            <Input
              type="date"
              value={filter.to}
              onChange={(e) => {
                setPage(1);
                setFilter((f) => ({ ...f, to: e.target.value }));
              }}
              className="w-[150px]"
            />
          </div>
          {/* Status */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </Label>
            <Select
              value={filter.status || "all"}
              onValueChange={(v) => {
                setPage(1);
                setFilter((f) => ({ ...f, status: v === "all" ? "" : v }));
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Page */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Page
            </Label>
            <Select
              value={filter.page_id || "all"}
              onValueChange={(v) => {
                setPage(1);
                setFilter((f) => ({ ...f, page_id: v === "all" ? "" : v }));
              }}
            >
              <SelectTrigger className="w-[200px]">
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
          {/* Search */}
          <div className="min-w-[220px] flex-1 space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Search buyer
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter.search}
                placeholder="Name or email"
                onChange={(e) => {
                  setPage(1);
                  setFilter((f) => ({ ...f, search: e.target.value }));
                }}
                className="pl-9"
              />
            </div>
          </div>
          {/* Reset (only visible when any filter is active) */}
          {anyFilterActive && (
            <Button
              variant="ghost"
              size="icon"
              onClick={resetFilters}
              aria-label="Reset filters"
              title="Reset filters"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {/* Export — right-aligned */}
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={exporting}
            className="ml-auto"
          >
            {exporting ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-2 h-3.5 w-3.5" />
            )}
            Export CSV
          </Button>
        </div>

        {/* Active-filter summary chip row */}
        {anyFilterActive && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3 w-3" />
            <span>
              <span className="font-medium text-foreground">
                {filtered.length.toLocaleString("en-IN")}
              </span>{" "}
              of {rows.length.toLocaleString("en-IN")} transactions
            </span>
          </div>
        )}
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {pageRows.length === 0 ? (
          <EmptyTable filtered={!!anyFilterActive} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <Th>Customer</Th>
                  <Th>Page</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  <Th className="w-8" srOnly>
                    Expand
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.map((row) => {
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
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
          <div className="text-xs text-muted-foreground">
            {filtered.length === 0 ? (
              <>No transactions</>
            ) : (
              <>
                Showing{" "}
                <span className="font-medium text-foreground">
                  {fromX}–{toX}
                </span>{" "}
                of{" "}
                <span className="font-medium text-foreground">
                  {filtered.length.toLocaleString("en-IN")}
                </span>{" "}
                · Revenue{" "}
                <span className="font-mono font-medium text-foreground">
                  {rupees(totalRevenue)}
                </span>{" "}
                · Commission{" "}
                <span className="font-mono text-muted-foreground">
                  {rupees(totalCommission)}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function Th({
  children,
  className,
  srOnly,
}: {
  children: React.ReactNode;
  className?: string;
  srOnly?: boolean;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {srOnly ? <span className="sr-only">{children}</span> : children}
    </th>
  );
}

function EmptyTable({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
        <Inbox className="h-5 w-5 text-indigo-600" />
      </div>
      <div>
        <p className="font-medium">
          {filtered ? "No matches" : "No transactions yet"}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {filtered
            ? "Try widening your date range or clearing a filter."
            : "Once buyers pay, you'll see every order here in real time."}
        </p>
      </div>
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
  // Left accent border on the expanded panel — colour matches the order's
  // status so the eye can scan for failed/refunded rows quickly.
  const accentBorder =
    row.status === "paid"
      ? "border-l-4 border-l-indigo-500"
      : row.status === "failed"
        ? "border-l-4 border-l-rose-500"
        : row.status === "refunded"
          ? "border-l-4 border-l-amber-500"
          : "border-l-4 border-l-border";

  return (
    <>
      <tr
        className="cursor-pointer transition-colors hover:bg-muted/30"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                "bg-gradient-to-br text-xs font-semibold text-white shadow-sm",
                gradientFor(row.buyer_email),
              )}
            >
              {buyerInitials(row.buyer_name, row.buyer_email)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">
                {row.buyer_name ?? row.buyer_email}
              </div>
              {row.buyer_name && (
                <div className="truncate text-xs text-muted-foreground">
                  {row.buyer_email}
                </div>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          {row.page_title ? (
            <span
              title={row.page_title}
              className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
            >
              {truncate(row.page_title, 20)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="font-mono text-sm font-semibold text-foreground">
            {rupees(row.amount)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            commission {rupees(row.platform_commission)}
          </div>
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={row.status} />
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {formatDateTime(row.created_at)}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          <ChevronsUpDown
            className={cn(
              "h-4 w-4 transition-transform",
              open && "rotate-180",
            )}
          />
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/20">
          <td colSpan={6} className={cn("p-0", accentBorder)}>
            <div className="px-6 py-5">
              <div className="grid gap-4 md:grid-cols-3">
                <DetailBlock label="Buyer">
                  <KV k="Name" v={row.buyer_name ?? "—"} />
                  <KV k="Email" v={row.buyer_email} />
                  <KV k="Phone" v={row.buyer_phone ?? "—"} />
                  <KV k="Address" v={formatAddress(row.buyer_address)} />
                </DetailBlock>
                <DetailBlock label="Payment">
                  <KV k="Gateway" v={row.payment_gateway ?? "—"} />
                  <KV
                    k="Payment ID"
                    v={row.gateway_payment_id ?? "—"}
                    mono
                  />
                  <KV k="Seller share" v={rupees(row.seller_amount)} mono />
                  {row.coupon_code && (
                    <KV
                      k="Coupon"
                      v={`${row.coupon_code}${row.discount_amount > 0 ? ` (−${rupees(row.discount_amount)})` : " (applied)"}`}
                    />
                  )}
                </DetailBlock>
                <DetailBlock label="Attribution (UTM)">
                  <KV k="Source" v={row.utm_source ?? "—"} />
                  <KV k="Medium" v={row.utm_medium ?? "—"} />
                  <KV k="Campaign" v={row.utm_campaign ?? "—"} />
                </DetailBlock>
              </div>

              {/* Action row */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {row.page_slug && (
                  <Button
                    size="sm"
                    variant="ghost"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={`/p/${row.page_slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      View page
                    </a>
                  </Button>
                )}
                {row.status === "paid" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={`/api/orders/${row.id}/invoice`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      Download invoice
                    </a>
                  </Button>
                )}
                {isAdmin && row.status === "paid" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefund(row.id);
                    }}
                    disabled={refunding}
                    className="ml-auto border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    {refunding && (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    )}
                    Refund
                  </Button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd
        className={cn(
          "min-w-0 text-right",
          mono && "break-all font-mono text-xs",
        )}
      >
        {v}
      </dd>
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
