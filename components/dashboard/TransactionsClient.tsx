"use client";

import { useEffect, useMemo, useState } from "react";
import { format, subDays, subMonths } from "date-fns";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  ExternalLink,
  FileText,
  Filter,
  IndianRupee,
  Inbox,
  Loader2,
  MailCheck,
  Search,
  ShoppingBag,
  TrendingUp,
  Undo2,
  X,
  XCircle,
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
  declineRefundRequestAction,
  exportTransactionsCsvAction,
  refundOrderAction,
  resendOrderDeliveryAction,
} from "@/actions/transactions";
import { cn, formatDateTime, formatINR, truncate } from "@/lib/utils";

const PAGE_SIZE = 25;
const STATUSES = ["paid", "pending", "failed", "refunded", "cancelled"];

// Quick date-range presets shown above the filter bar. "custom" reveals the
// explicit From/To pickers; the others compute a range relative to today.
const DATE_PRESETS = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "1m", label: "Last 1 month" },
  { key: "custom", label: "Custom" },
] as const;

type PresetKey = (typeof DATE_PRESETS)[number]["key"];

// yyyy-MM-dd in local time — matches the value the <input type="date"> emits.
function rangeForPreset(key: PresetKey): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  switch (key) {
    case "today":
      return { from: fmt(today), to: fmt(today) };
    case "yesterday": {
      const y = subDays(today, 1);
      return { from: fmt(y), to: fmt(y) };
    }
    case "7d":
      return { from: fmt(subDays(today, 6)), to: fmt(today) };
    case "1m":
      return { from: fmt(subMonths(today, 1)), to: fmt(today) };
    default:
      return { from: "", to: "" };
  }
}

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
  /** "none" | "requested" | "declined" — buyer-initiated refund request. */
  refund_request_status?: string | null;
  refund_request_reason?: string | null;
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
  /** The seller may refund their OWN seller-gateway orders (the server action
   *  still blocks platform-gateway orders for non-admins). */
  canRefund?: boolean;
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
  canRefund,
}: TransactionsClientProps) {
  const { toast } = useToast();
  const [filter, setFilter] = useState(initialFilter);
  const [preset, setPreset] = useState<PresetKey>(
    initialFilter.from || initialFilter.to ? "custom" : "all",
  );
  const [page, setPage] = useState(1);

  // Prefill the buyer search when arriving from the global command palette
  // (/dashboard/transactions?q=...).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setFilter((f) => ({ ...f, search: q }));
  }, []);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  // Everything EXCEPT the status filter — so the status chips can show live
  // counts for the current date/page/search selection.
  const baseFiltered = useMemo(() => {
    return rows.filter((r) => {
      if (filter.from && new Date(r.created_at) < new Date(filter.from)) return false;
      if (filter.to && new Date(r.created_at) > endOfDay(filter.to)) return false;
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
  }, [rows, filter.from, filter.to, filter.page_id, filter.search, pages]);

  const filtered = useMemo(
    () =>
      filter.status
        ? baseFiltered.filter((r) => r.status === filter.status)
        : baseFiltered,
    [baseFiltered, filter.status],
  );

  // Per-status counts for the quick-filter chips (based on the non-status set).
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: baseFiltered.length };
    for (const s of STATUSES) counts[s] = 0;
    for (const r of baseFiltered) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    return counts;
  }, [baseFiltered]);

  // Summary stats for the cards — reflect the currently filtered rows.
  const summary = useMemo(() => {
    let paidRevenue = 0;
    let paidCount = 0;
    let refunded = 0;
    for (const r of filtered) {
      if (r.status === "paid") {
        paidRevenue += Number(r.amount ?? 0);
        paidCount += 1;
      }
      if (r.status === "refunded" || r.status === "partially_refunded") {
        refunded += Number(r.amount ?? 0);
      }
    }
    return {
      paidRevenue,
      paidCount,
      refunded,
      aov: paidCount > 0 ? paidRevenue / paidCount : 0,
    };
  }, [filtered]);

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

  function applyPreset(key: PresetKey) {
    setPage(1);
    setPreset(key);
    // "Custom" keeps whatever range is already set and just reveals the
    // pickers; every other preset overwrites from/to with its computed range.
    if (key === "custom") return;
    const range = rangeForPreset(key);
    setFilter((f) => ({ ...f, from: range.from, to: range.to }));
  }

  function resetFilters() {
    setFilter({ from: "", to: "", status: "", page_id: "", search: "" });
    setPreset("all");
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

  async function onRefund(orderId: string, fullAmount: number) {
    // Prompt for the amount — full by default; a smaller value = partial refund.
    const input = window.prompt(
      `Refund amount in ₹ (full = ${fullAmount}). Enter a smaller amount for a partial refund.`,
      String(fullAmount),
    );
    if (input == null) return; // cancelled
    const amount = Number(input.trim());
    if (!Number.isFinite(amount) || amount <= 0 || amount > fullAmount) {
      toast({
        title: "Invalid amount",
        description: `Enter a value between 1 and ${fullAmount}.`,
        variant: "destructive",
      });
      return;
    }
    setRefundingId(orderId);
    const r = await refundOrderAction(orderId, amount);
    setRefundingId(null);
    if (!r.ok) {
      toast({
        title: "Refund failed",
        description: r.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: amount < fullAmount ? "Partial refund issued" : "Order refunded",
    });
  }

  const fromX = Math.min((page - 1) * PAGE_SIZE + 1, filtered.length);
  const toX = Math.min(page * PAGE_SIZE, filtered.length);

  return (
    <div className="space-y-4">
      {/* ── Summary cards — reflect the active filters ────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          label="Revenue (paid)"
          value={rupees(summary.paidRevenue)}
          tile="tile-emerald"
          icon={IndianRupee}
        />
        <MiniStat
          label="Paid Orders"
          value={summary.paidCount.toLocaleString("en-IN")}
          tile="tile-indigo"
          icon={ShoppingBag}
        />
        <MiniStat
          label="Avg Order Value"
          value={rupees(summary.aov)}
          tile="tile-violet"
          icon={TrendingUp}
        />
        <MiniStat
          label="Refunded"
          value={rupees(summary.refunded)}
          tile="tile-rose"
          icon={Undo2}
        />
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <div className="card-surface p-4">
        {/* Date-range presets */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="th-label mr-1 inline-flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5 text-indigo-500" />
            Period
          </span>
          {DATE_PRESETS.map((p) => {
            const isActive = preset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  isActive
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/30"
                    : "border border-border bg-card text-muted-foreground hover:border-indigo-300 hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Custom From/To — only when the Custom preset is selected */}
        {preset === "custom" && (
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
            <div className="space-y-1">
              <Label className="th-label">From</Label>
              <Input
                type="date"
                value={filter.from}
                onChange={(e) => {
                  setPage(1);
                  setFilter((f) => ({ ...f, from: e.target.value }));
                }}
                className="w-[150px] bg-card dark:bg-card"
              />
            </div>
            <div className="space-y-1">
              <Label className="th-label">To</Label>
              <Input
                type="date"
                value={filter.to}
                onChange={(e) => {
                  setPage(1);
                  setFilter((f) => ({ ...f, to: e.target.value }));
                }}
                className="w-[150px] bg-card dark:bg-card"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          {/* Page */}
          <div className="space-y-1">
            <Label className="th-label">
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
            <Label className="th-label">
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

      {/* ── Status quick filters (with live counts) ──────────────────── */}
      <div className="flex flex-wrap gap-2">
        <StatusChip
          label="All"
          count={statusCounts.all}
          active={!filter.status}
          onClick={() => {
            setPage(1);
            setFilter((f) => ({ ...f, status: "" }));
          }}
        />
        {STATUSES.map((s) => (
          <StatusChip
            key={s}
            label={s}
            count={statusCounts[s] ?? 0}
            active={filter.status === s}
            tone={s}
            onClick={() => {
              setPage(1);
              setFilter((f) => ({ ...f, status: filter.status === s ? "" : s }));
            }}
          />
        ))}
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="card-surface overflow-hidden">
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
                      canRefund={!!canRefund}
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
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          tile,
        )}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="th-label truncate">{label}</p>
        <p className="mt-0.5 font-sora text-lg font-bold tabular-nums text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

// Active-chip colours per status (dark-aware).
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
      className={cn("th-label px-4 py-3", className)}
    >
      {srOnly ? <span className="sr-only">{children}</span> : children}
    </th>
  );
}

function EmptyTable({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100/60 ring-1 ring-inset ring-indigo-200/70 dark:from-indigo-500/15 dark:to-indigo-500/5 dark:ring-indigo-500/30">
        <Inbox className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
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

function DeclineRefundButton({ orderId }: { orderId: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        if (!confirm("Decline this refund request? The buyer is not refunded.")) return;
        setBusy(true);
        const r = await declineRefundRequestAction(orderId);
        setBusy(false);
        toast({
          title: r.ok ? "Request declined" : "Couldn't decline",
          description: r.message,
          variant: r.ok ? undefined : "destructive",
        });
      }}
    >
      {busy ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <XCircle className="mr-1.5 h-3.5 w-3.5" />
      )}
      Decline request
    </Button>
  );
}

function ResendDeliveryButton({ orderId }: { orderId: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        const r = await resendOrderDeliveryAction(orderId);
        setBusy(false);
        toast({
          title: r.ok ? "Delivery resent" : "Couldn't resend",
          description: r.message,
          variant: r.ok ? undefined : "destructive",
        });
      }}
    >
      {busy ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <MailCheck className="mr-1.5 h-3.5 w-3.5" />
      )}
      Resend delivery
    </Button>
  );
}

function ExpandableRow({
  row,
  open,
  onToggle,
  isAdmin,
  canRefund,
  onRefund,
  refunding,
}: {
  row: TransactionRow;
  open: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  canRefund: boolean;
  onRefund: (id: string, amount: number) => void;
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
              className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
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
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status={row.status} />
            {row.refund_request_status === "requested" && row.status === "paid" && (
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Refund requested
              </span>
            )}
          </div>
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

              {/* Buyer refund request notice */}
              {row.refund_request_status === "requested" && row.status === "paid" && (
                <div className="mt-4 rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Buyer requested a refund
                  </p>
                  {row.refund_request_reason && (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                      “{row.refund_request_reason}”
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Approve by issuing a refund below, or decline the request.
                  </p>
                </div>
              )}

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
                {row.status === "paid" && <ResendDeliveryButton orderId={row.id} />}
                {row.refund_request_status === "requested" && row.status === "paid" && (
                  <DeclineRefundButton orderId={row.id} />
                )}
                {(isAdmin || canRefund) &&
                  (row.status === "paid" ||
                    row.status === "partially_refunded") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRefund(row.id, Number(row.amount));
                      }}
                      disabled={refunding}
                      className="ml-auto border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                    >
                      {refunding && (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      )}
                      {row.status === "partially_refunded" ? "Refund more" : "Refund"}
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
    <div className="rounded-lg border border-border bg-card p-3">
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
