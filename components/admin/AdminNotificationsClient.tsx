"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Mail, MessageCircle, Phone, Search, Send } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface NotifLogRow {
  channel: "email" | "whatsapp" | "sms";
  eventKey: string | null;
  recipient: string;
  subject: string | null;
  status: "sent" | "failed" | "skipped";
  provider: string | null;
  error: string | null;
  createdAt: string;
}

const CHANNEL_ICON = { email: Mail, whatsapp: MessageCircle, sms: Phone } as const;

function StatusBadge({ status }: { status: NotifLogRow["status"] }) {
  const tone =
    status === "sent"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : status === "failed"
        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
        : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", tone)}>
      {status}
    </span>
  );
}

export function AdminNotificationsClient({ rows }: { rows: NotifLogRow[] }) {
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<"all" | NotifLogRow["channel"]>("all");
  const [status, setStatus] = useState<"all" | NotifLogRow["status"]>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (channel === "all" || r.channel === channel) &&
        (status === "all" || r.status === status) &&
        (!q ||
          r.recipient.toLowerCase().includes(q) ||
          (r.subject?.toLowerCase().includes(q) ?? false) ||
          (r.eventKey?.toLowerCase().includes(q) ?? false)),
    );
  }, [rows, search, channel, status]);

  const stats = useMemo(() => {
    let sent = 0,
      failed = 0,
      skipped = 0;
    for (const r of rows) {
      if (r.status === "sent") sent++;
      else if (r.status === "failed") failed++;
      else skipped++;
    }
    return { sent, failed, skipped };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Total" value={rows.length} tile="tile-indigo" icon={Send} />
        <MiniStat label="Sent" value={stats.sent} tile="tile-emerald" icon={Send} />
        <MiniStat label="Failed" value={stats.failed} tile="tile-rose" icon={Send} />
        <MiniStat label="Skipped (unconfigured)" value={stats.skipped} tile="tile-amber" icon={Send} />
      </div>

      <div className="card-surface flex flex-wrap items-center gap-3 p-4">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} placeholder="Search recipient, subject, event…" onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="all">All channels</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>

      <div className="card-surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="th-label">Channel</TableHead>
              <TableHead className="th-label">Recipient</TableHead>
              <TableHead className="th-label">Subject / event</TableHead>
              <TableHead className="th-label">Status</TableHead>
              <TableHead className="th-label">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No notifications sent yet." : "No matches."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r, i) => {
                const Icon = CHANNEL_ICON[r.channel];
                return (
                  <TableRow key={i} className="transition-colors hover:bg-muted/30">
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm capitalize">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {r.channel}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.recipient}</TableCell>
                    <TableCell>
                      <div className="text-sm">{r.subject ?? r.eventKey ?? "—"}</div>
                      {r.error && <div className="text-xs text-rose-500">{r.error}</div>}
                    </TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(r.createdAt), "d MMM, HH:mm")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Showing {filtered.length.toLocaleString("en-IN")} of {rows.length.toLocaleString("en-IN")}.
        In-app (bell) notifications live in the Customers/Users feeds, not here.
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
  value: number;
  tile: string;
  icon: typeof Send;
}) {
  return (
    <div className="card-surface flex items-center gap-3 p-4">
      <span aria-hidden className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tile)}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="th-label truncate">{label}</p>
        <p className="mt-0.5 font-sora text-lg font-bold tabular-nums text-foreground">{value.toLocaleString("en-IN")}</p>
      </div>
    </div>
  );
}
