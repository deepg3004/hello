"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Activity, ScrollText, Search, Users, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface AuditLogRow {
  id: string;
  admin_id: string | null;
  admin_name: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  details: string | null;
  created_at: string;
}

export function AdminAuditLogsClient({ rows }: { rows: AuditLogRow[] }) {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const actionOptions = useMemo(
    () => [...new Set(rows.map((r) => r.action))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (action !== "all" && r.action !== action) return false;
      if (from && new Date(r.created_at) < new Date(from)) return false;
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (new Date(r.created_at) > end) return false;
      }
      if (q) {
        const hay = `${r.admin_name} ${r.action} ${r.target_type ?? ""} ${r.target_id ?? ""} ${r.ip_address ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, action, from, to]);

  const summary = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let today = 0;
    const admins = new Set<string>();
    for (const r of filtered) {
      admins.add(r.admin_id ?? r.admin_name);
      if (new Date(r.created_at) >= todayStart) today += 1;
    }
    return {
      total: filtered.length,
      admins: admins.size,
      actions: new Set(filtered.map((r) => r.action)).size,
      today,
    };
  }, [filtered]);

  const anyFilter = !!search || action !== "all" || !!from || !!to;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Actions" value={summary.total.toLocaleString("en-IN")} tile="tile-indigo" icon={ScrollText} />
        <Stat label="Admins" value={summary.admins.toLocaleString("en-IN")} tile="tile-emerald" icon={Users} />
        <Stat label="Action Types" value={summary.actions.toLocaleString("en-IN")} tile="tile-violet" icon={Zap} />
        <Stat label="Today" value={summary.today.toLocaleString("en-IN")} tile="tile-amber" icon={Activity} />
      </div>

      {/* Filters */}
      <div className="card-surface flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1 space-y-1">
          <Label className="th-label">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Admin, action, target or IP"
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="th-label">Action</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actionOptions.map((a) => (
                <SelectItem key={a} value={a} className="font-mono text-xs">
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="th-label">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
        </div>
        <div className="space-y-1">
          <Label className="th-label">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
        </div>
      </div>

      {/* Table */}
      <div className="card-surface overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full tile-indigo">
              <ScrollText className="h-5 w-5" />
            </div>
            <span className="text-sm text-muted-foreground">
              {anyFilter ? "No actions match these filters." : "No actions logged yet."}
            </span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="th-label">When</TableHead>
                <TableHead className="th-label">Admin</TableHead>
                <TableHead className="th-label">Action</TableHead>
                <TableHead className="th-label">Target</TableHead>
                <TableHead className="th-label">IP</TableHead>
                <TableHead className="th-label">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="transition-colors hover:bg-muted/30">
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format(new Date(r.created_at), "d MMM yyyy, HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    {r.admin_id ? (
                      <Link href={`/admin/users/${r.admin_id}`} className="hover:underline">
                        {r.admin_name}
                      </Link>
                    ) : (
                      r.admin_name
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {r.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.target_type ? (
                      <span>
                        {r.target_type}
                        {r.target_id ? ` · ${r.target_id.slice(0, 8)}` : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.ip_address ?? "—"}
                  </TableCell>
                  <TableCell>
                    {r.details ? (
                      <code className="text-xs text-muted-foreground">
                        {r.details.slice(0, 60)}
                      </code>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Showing {filtered.length.toLocaleString("en-IN")} of{" "}
        {rows.length.toLocaleString("en-IN")} entries (latest 500).
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
  icon: typeof Users;
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
