"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Chrome, Mail, Search, UserCircle, Users } from "lucide-react";

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

export interface AdminBuyerRow {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: "google" | "email_otp";
  emailVerified: boolean;
  loginCount: number;
  lastLoginAt: string;
}

export interface AdminBuyerLoginRow {
  email: string;
  provider: "google" | "email_otp";
  host: string | null;
  createdAt: string;
}

function ProviderBadge({ provider }: { provider: "google" | "email_otp" }) {
  const isGoogle = provider === "google";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        isGoogle
          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
          : "bg-muted text-muted-foreground",
      )}
    >
      {isGoogle ? <Chrome className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
      {isGoogle ? "Google" : "Email OTP"}
    </span>
  );
}

export function AdminBuyersClient({
  rows,
  logins,
}: {
  rows: AdminBuyerRow[];
  logins: AdminBuyerLoginRow[];
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) => r.email.includes(s) || (r.name?.toLowerCase().includes(s) ?? false),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const google = rows.filter((r) => r.provider === "google").length;
    return { total: rows.length, google, otp: rows.length - google };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MiniStat label="Buyer accounts" value={stats.total.toLocaleString("en-IN")} tile="tile-indigo" icon={Users} />
        <MiniStat label="Google logins" value={stats.google.toLocaleString("en-IN")} tile="tile-violet" icon={Chrome} />
        <MiniStat label="Email-OTP logins" value={stats.otp.toLocaleString("en-IN")} tile="tile-emerald" icon={Mail} />
      </div>

      <div className="card-surface p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder="Search email or name…"
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="card-surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="th-label">Buyer</TableHead>
              <TableHead className="th-label">Provider</TableHead>
              <TableHead className="th-label text-right">Logins</TableHead>
              <TableHead className="th-label">Last login</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full tile-indigo">
                      <UserCircle className="h-5 w-5" />
                    </div>
                    {rows.length === 0
                      ? "No buyer accounts yet — they appear after the first portal login."
                      : "No matches."}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.email} className="transition-colors hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.avatarUrl ? (
                        <img src={r.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                          <UserCircle className="h-4 w-4 text-muted-foreground" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium">{r.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><ProviderBadge provider={r.provider} /></TableCell>
                  <TableCell className="text-right tabular-nums">{r.loginCount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(r.lastLoginAt), "d MMM yyyy, HH:mm")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="card-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Recent logins</h2>
        {logins.length === 0 ? (
          <p className="text-sm text-muted-foreground">No login events yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {logins.map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ProviderBadge provider={l.provider} />
                  <span className="truncate text-foreground">{l.email}</span>
                  {l.host && (
                    <span className="truncate text-xs text-muted-foreground">on {l.host}</span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(l.createdAt), "d MMM, HH:mm")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
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
