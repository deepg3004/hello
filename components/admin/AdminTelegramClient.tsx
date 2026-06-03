"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { Search, Send } from "lucide-react";

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
import { TelegramMembershipActions } from "@/components/admin/TelegramMembershipActions";
import { cn } from "@/lib/utils";

export interface AdminTelegramRow {
  id: string;
  buyer_email: string;
  telegram_user_id: string | null;
  status: string;
  joined_at: string | null;
  expires_at: string | null;
  group_name: string | null;
  group_id: string;
  owner_user_id: string | null;
}

const CHIP_ACTIVE: Record<string, string> = {
  all: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300",
  active: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  invited: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300",
  expired: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  removed: "bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300",
};

export function AdminTelegramClient({ rows }: { rows: AdminTelegramRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const base = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.buyer_email.toLowerCase().includes(s) ||
        (r.group_name?.toLowerCase().includes(s) ?? false) ||
        r.group_id.toLowerCase().includes(s),
    );
  }, [rows, search]);

  // Distinct statuses present, plus their counts (over the searched set).
  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const r of base) set.add(r.status);
    return [...set].sort();
  }, [base]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: base.length };
    for (const r of base) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [base]);

  const filtered = useMemo(
    () => (status ? base.filter((r) => r.status === status) : base),
    [base, status],
  );

  return (
    <div className="space-y-4">
      {/* Search + status chips */}
      <div className="card-surface flex flex-col gap-3 p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder="Search buyer or group…"
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip label="All" count={counts.all} active={!status} onClick={() => setStatus("")} />
          {statuses.map((s) => (
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

      {/* Table */}
      <div className="card-surface overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full tile-indigo">
              <Send className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              {rows.length === 0 ? "No memberships yet." : "No matches for these filters."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="th-label">Buyer</TableHead>
                <TableHead className="th-label">Group</TableHead>
                <TableHead className="th-label">Status</TableHead>
                <TableHead className="th-label">Joined</TableHead>
                <TableHead className="th-label">Expires</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => {
                const expiresAt = m.expires_at ? new Date(m.expires_at) : null;
                const isFuture = expiresAt ? expiresAt > new Date() : false;
                return (
                  <TableRow key={m.id} className="transition-colors hover:bg-muted/30">
                    <TableCell>
                      <div className="font-medium">{m.buyer_email}</div>
                      {m.telegram_user_id && (
                        <div className="font-mono text-xs text-muted-foreground">
                          tg:{m.telegram_user_id}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{m.group_name ?? "—"}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {m.group_id}
                      </div>
                      {m.owner_user_id && (
                        <Link
                          href={`/admin/users/${m.owner_user_id}`}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          Owner
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={m.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.joined_at ? format(new Date(m.joined_at), "d MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      {expiresAt ? (
                        <div>
                          <div>{format(expiresAt, "d MMM yyyy")}</div>
                          <div className="text-xs text-muted-foreground">
                            {isFuture
                              ? `in ${formatDistanceToNow(expiresAt)}`
                              : `${formatDistanceToNow(expiresAt)} ago`}
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline">Lifetime</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {(m.status === "active" || m.status === "invited") && (
                        <TelegramMembershipActions membershipId={m.id} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Showing {filtered.length.toLocaleString("en-IN")} of{" "}
        {rows.length.toLocaleString("en-IN")} memberships (latest 500).
      </p>
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
