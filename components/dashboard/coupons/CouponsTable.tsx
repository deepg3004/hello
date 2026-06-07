"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  CalendarClock,
  CheckCircle2,
  Copy,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Repeat,
  TimerOff,
  Trash2,
} from "lucide-react";

import {
  deleteCouponAction,
  duplicateCouponAction,
  toggleCouponActiveAction,
} from "@/actions/coupons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { CouponDialog } from "./CouponDialog";

export interface CouponRow {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order: number;
  max_discount: number | null;
  total_limit: number | null;
  per_customer_limit: number;
  usage_count: number;
  starts_at: string | null;
  expires_at: string | null;
  page_ids: string[];
  active: boolean;
  show_at_checkout: boolean;
  created_at: string;
}

interface CouponsTableProps {
  coupons: CouponRow[];
  pages: Array<{ id: string; title: string }>;
}

type Lifecycle = "active" | "scheduled" | "expired" | "inactive";
type SortKey = "newest" | "used" | "code";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "newest", label: "Newest" },
  { key: "used", label: "Most used" },
  { key: "code", label: "Code A–Z" },
];

const SEG_ACTIVE: Record<string, string> = {
  all: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300",
  active: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  scheduled: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300",
  expired: "bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300",
  inactive: "bg-zinc-500/15 text-muted-foreground ring-zinc-500/30 dark:text-zinc-300",
};

const SEGMENTS: Array<{ key: Lifecycle | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "scheduled", label: "Scheduled" },
  { key: "expired", label: "Expired" },
  { key: "inactive", label: "Inactive" },
];

export function CouponsTable({ coupons, pages }: CouponsTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [segment, setSegment] = useState<Lifecycle | "all">("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const now = useMemo(() => Date.now(), []);
  const enriched = useMemo(
    () =>
      coupons.map((c) => {
        const expired = c.expires_at ? Date.parse(c.expires_at) < now : false;
        const scheduled = c.starts_at ? Date.parse(c.starts_at) > now : false;
        const depleted =
          c.total_limit !== null && c.usage_count >= c.total_limit;
        // Lifecycle drives summary cards + segment chips (spec order):
        // inactive → scheduled → expired → active.
        const lifecycle: Lifecycle = !c.active
          ? "inactive"
          : scheduled
            ? "scheduled"
            : expired
              ? "expired"
              : "active";
        return { ...c, expired, scheduled, depleted, lifecycle };
      }),
    [coupons, now],
  );

  // Summary counts across all coupons (independent of the active segment).
  const summary = useMemo(() => {
    const counts = { active: 0, scheduled: 0, expired: 0, inactive: 0 };
    let redemptions = 0;
    for (const c of enriched) {
      counts[c.lifecycle] += 1;
      redemptions += c.usage_count;
    }
    return { ...counts, redemptions };
  }, [enriched]);

  const segCounts = useMemo(
    () => ({
      all: enriched.length,
      active: summary.active,
      scheduled: summary.scheduled,
      expired: summary.expired,
      inactive: summary.inactive,
    }),
    [enriched.length, summary],
  );

  const visible = useMemo(() => {
    const rows =
      segment === "all"
        ? enriched
        : enriched.filter((c) => c.lifecycle === segment);
    const sorted = [...rows];
    if (sort === "newest") {
      sorted.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    } else if (sort === "used") {
      sorted.sort((a, b) => b.usage_count - a.usage_count);
    } else {
      sorted.sort((a, b) => a.code.localeCompare(b.code));
    }
    return sorted;
  }, [enriched, segment, sort]);

  async function toggleActive(c: CouponRow) {
    setBusy(`active-${c.id}`);
    const r = await toggleCouponActiveAction(c.id);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't toggle", description: r.message, variant: "destructive" });
      return;
    }
    router.refresh();
  }

  async function duplicate(id: string) {
    setBusy(`dup-${id}`);
    const r = await duplicateCouponAction(id);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Duplicate failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Duplicated", description: "Saved as inactive — edit the code first." });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this coupon? This cannot be undone.")) return;
    setBusy(`del-${id}`);
    const r = await deleteCouponAction(id);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Delete failed", description: r.message, variant: "destructive" });
      return;
    }
    router.refresh();
  }

  return (
    <>
      {/* Summary stat cards — computed from the coupon rows. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          tile="tile-emerald"
          icon={CheckCircle2}
          label="Active coupons"
          value={summary.active}
        />
        <SummaryCard
          tile="tile-indigo"
          icon={Repeat}
          label="Total redemptions"
          value={summary.redemptions}
        />
        <SummaryCard
          tile="tile-violet"
          icon={CalendarClock}
          label="Scheduled"
          value={summary.scheduled}
        />
        <SummaryCard
          tile="tile-rose"
          icon={TimerOff}
          label="Expired"
          value={summary.expired}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {visible.length} of {coupons.length} coupon
              {coupons.length === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => setCreating(true)}>
                <Plus className="mr-2 h-4 w-4" /> New coupon
              </Button>
            </div>
          </div>

          {/* Status segment chips with live counts. */}
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((s) => (
              <SegChip
                key={s.key}
                label={s.label}
                count={segCounts[s.key]}
                tone={s.key}
                active={segment === s.key}
                onClick={() => setSegment(s.key)}
              />
            ))}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      {coupons.length === 0 ? (
                        <>
                          No coupons yet. Click <strong>New coupon</strong> to create your first.
                        </>
                      ) : (
                        "No coupons match this filter."
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((c) => {
                    const status = !c.active
                      ? "inactive"
                      : c.expired
                        ? "expired"
                        : c.depleted
                          ? "depleted"
                          : "active";
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{c.code}</code>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {c.page_ids.length === 0
                              ? "All pages"
                              : `${c.page_ids.length} page${c.page_ids.length === 1 ? "" : "s"}`}
                          </p>
                        </TableCell>
                        <TableCell>
                          {c.discount_type === "percentage"
                            ? `${c.discount_value}%${c.max_discount ? ` · max ₹${c.max_discount}` : ""}`
                            : `₹${c.discount_value}`}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.usage_count} / {c.total_limit ?? "∞"}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.expires_at ? format(new Date(c.expires_at), "d MMM yyyy") : "—"}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={c.active}
                            onCheckedChange={() => toggleActive(c)}
                            disabled={busy === `active-${c.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                {busy?.startsWith("dup-") && busy.endsWith(c.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onSelect={() => setEditing(c)}>
                                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => duplicate(c.id)}>
                                <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => remove(c.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CouponDialog open={creating} onOpenChange={setCreating} pages={pages} />
      <CouponDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        pages={pages}
        initial={editing ?? undefined}
      />
    </>
  );
}

function SummaryCard({
  tile,
  icon: Icon,
  label,
  value,
}: {
  tile: string;
  icon: typeof CheckCircle2;
  label: string;
  value: number;
}) {
  return (
    <div className="card-surface flex items-center gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-md">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          tile,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="font-sora text-lg font-bold tabular-nums text-foreground">
          {value.toLocaleString("en-IN")}
        </p>
      </div>
    </div>
  );
}

function SegChip({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  label: string;
  count: number;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  const activeCls = SEG_ACTIVE[tone] ?? SEG_ACTIVE.all;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition",
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

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800",
    inactive: "bg-zinc-200 text-muted-foreground",
    expired: "bg-zinc-200 text-muted-foreground",
    depleted: "bg-amber-100 text-amber-800",
  };
  return (
    <Badge variant="outline" className={`border-transparent capitalize ${map[status] ?? ""}`}>
      {status}
    </Badge>
  );
}
