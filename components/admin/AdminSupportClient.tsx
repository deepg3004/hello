"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CheckCircle2, Inbox, LifeBuoy, Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

export interface AdminTicketRow {
  id: string;
  subject: string;
  from_email: string;
  from_name: string | null;
  status: string;
  last_message_at: string;
  user_id: string | null;
  linked_name: string | null;
  linked_email: string | null;
}

const CHIP_ACTIVE: Record<string, string> = {
  all: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300",
  open: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  in_progress: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300",
  resolved: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  closed: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
};

export function AdminSupportClient({ rows }: { rows: AdminTicketRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const base = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.subject.toLowerCase().includes(s) ||
        r.from_email.toLowerCase().includes(s) ||
        (r.from_name?.toLowerCase().includes(s) ?? false) ||
        (r.linked_name?.toLowerCase().includes(s) ?? false) ||
        (r.linked_email?.toLowerCase().includes(s) ?? false),
    );
  }, [rows, search]);

  const statuses = useMemo(
    () => [...new Set(base.map((r) => r.status))].sort(),
    [base],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: base.length };
    for (const r of base) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [base]);

  const filtered = useMemo(
    () => (status ? base.filter((r) => r.status === status) : base),
    [base, status],
  );

  const summary = useMemo(() => {
    let open = 0;
    let inProgress = 0;
    let done = 0;
    for (const r of rows) {
      if (r.status === "open") open += 1;
      else if (r.status === "in_progress") inProgress += 1;
      else if (r.status === "resolved" || r.status === "closed") done += 1;
    }
    return { total: rows.length, open, inProgress, done };
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tickets" value={summary.total.toLocaleString("en-IN")} tile="tile-indigo" icon={LifeBuoy} />
        <Stat label="Open" value={summary.open.toLocaleString("en-IN")} tile="tile-amber" icon={Inbox} />
        <Stat label="In Progress" value={summary.inProgress.toLocaleString("en-IN")} tile="tile-violet" icon={Loader2} />
        <Stat label="Resolved" value={summary.done.toLocaleString("en-IN")} tile="tile-emerald" icon={CheckCircle2} />
      </div>

      {/* Search + status chips */}
      <div className="card-surface flex flex-col gap-3 p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder="Search subject, sender or user…"
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

      {/* Table */}
      <div className="card-surface overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full tile-indigo">
              <Inbox className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              {rows.length === 0 ? "No tickets yet." : "No tickets match these filters."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="th-label">Subject</TableHead>
                <TableHead className="th-label">From</TableHead>
                <TableHead className="th-label">Linked user</TableHead>
                <TableHead className="th-label">Status</TableHead>
                <TableHead className="th-label">Last message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} className="transition-colors hover:bg-muted/30">
                  <TableCell>
                    <Link href={`/admin/support/${t.id}`} className="font-medium hover:underline">
                      {t.subject || "(no subject)"}
                    </Link>
                    <div className="text-xs text-muted-foreground">#{t.id.slice(0, 8)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{t.from_name ?? t.from_email}</div>
                    {t.from_name && (
                      <div className="text-xs text-muted-foreground">{t.from_email}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.user_id ? (
                      <Link href={`/admin/users/${t.user_id}`} className="hover:underline">
                        {t.linked_name ?? t.linked_email ?? "—"}
                      </Link>
                    ) : (
                      <Badge variant="outline">Unlinked</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(t.last_message_at), "d MMM yyyy, HH:mm")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Showing {filtered.length.toLocaleString("en-IN")} of{" "}
        {rows.length.toLocaleString("en-IN")} tickets (latest 200).
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tile,
  icon: Icon,
}: {
  label: string;
  value: string;
  tile: string;
  icon: typeof Inbox;
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
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 font-sora text-lg font-bold tabular-nums text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

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
