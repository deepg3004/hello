"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Filter,
  Inbox,
  MoreVertical,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserX,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { PLANS, type PlanKey } from "@/lib/plans";
import { cn, formatDate } from "@/lib/utils";

export interface AdminUserRow {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  subscription_plan: string;
  subscription_status: string;
  kyc_level: number;
  is_admin: boolean;
  suspended: boolean;
  total_revenue: number;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
] as const;

// Plan badge palette — small coloured pill per plan.
const PLAN_BADGE: Record<string, string> = {
  free: "bg-zinc-100 text-zinc-700 border-zinc-200",
  starter: "bg-sky-50 text-sky-700 border-sky-200",
  pro: "bg-indigo-50 text-indigo-700 border-indigo-200",
  business: "bg-amber-50 text-amber-700 border-amber-200",
};

// Deterministic gradient avatar (FNV-1a hash → 5 buckets) shared with the
// user dashboard CustomersClient — keeps the same person identifiable.
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

function makeInitials(s: string): string {
  return s
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function UsersTable({ users }: { users: AdminUserRow[] }) {
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [kyc, setKyc] = useState("all");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (
        q &&
        !u.email.toLowerCase().includes(q) &&
        !u.full_name?.toLowerCase().includes(q)
      )
        return false;
      if (plan !== "all" && u.subscription_plan !== plan) return false;
      if (kyc !== "all" && String(u.kyc_level) !== kyc) return false;
      if (status === "active" && u.suspended) return false;
      if (status === "suspended" && !u.suspended) return false;
      if (from && new Date(u.created_at) < new Date(from)) return false;
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (new Date(u.created_at) > end) return false;
      }
      return true;
    });
  }, [users, search, plan, kyc, status, from, to]);

  const anyFilter =
    !!search || plan !== "all" || kyc !== "all" || status !== "all" || !!from || !!to;

  function reset() {
    setSearch("");
    setPlan("all");
    setKyc("all");
    setStatus("all");
    setFrom("");
    setTo("");
  }

  return (
    <div className="space-y-4">
      {/* ── Filter bar ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1 space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Search
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or email"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Plan
            </Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All plans</SelectItem>
                {Object.values(PLANS).map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              KYC level
            </Label>
            <Select value={kyc} onValueChange={setKyc}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="0">Level 0 — none</SelectItem>
                <SelectItem value="1">Level 1 — basic</SelectItem>
                <SelectItem value="2">Level 2 — bank</SelectItem>
                <SelectItem value="3">Level 3 — full</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              From
            </Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              To
            </Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-[150px]"
            />
          </div>
          {anyFilter && (
            <Button
              variant="ghost"
              size="icon"
              onClick={reset}
              aria-label="Reset filters"
              title="Reset filters"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {anyFilter && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3 w-3" />
            <span>
              <span className="font-medium text-foreground">
                {filtered.length.toLocaleString("en-IN")}
              </span>{" "}
              of {users.length.toLocaleString("en-IN")} users
            </span>
          </div>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {filtered.length === 0 ? (
          <EmptyState filtered={anyFilter} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <Th>User</Th>
                  <Th>Plan</Th>
                  <Th>KYC</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Revenue</Th>
                  <Th>Joined</Th>
                  <Th className="w-8 sr-only">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u) => (
                  <UserRow key={u.id} user={u} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          Showing {filtered.length.toLocaleString("en-IN")} of{" "}
          {users.length.toLocaleString("en-IN")} users
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
        <Inbox className="h-5 w-5 text-indigo-600" />
      </div>
      <div>
        <p className="font-medium">
          {filtered ? "No users match the filter" : "No users yet"}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {filtered
            ? "Try widening the date range or clearing a filter."
            : "Once sellers sign up they'll show up here."}
        </p>
      </div>
    </div>
  );
}

function UserRow({ user: u }: { user: AdminUserRow }) {
  const planName =
    (PLANS as Record<string, { name: string }>)[u.subscription_plan]?.name ?? "Free";
  const planClass = PLAN_BADGE[u.subscription_plan] ?? PLAN_BADGE.free!;

  return (
    <tr className="transition-colors hover:bg-muted/30">
      {/* User cell — gradient avatar + name + email */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              "bg-gradient-to-br text-xs font-semibold text-white shadow-sm",
              gradientFor(u.email),
            )}
          >
            {makeInitials(u.full_name ?? u.email)}
          </span>
          <div className="min-w-0">
            <Link
              href={`/admin/users/${u.id}`}
              className="font-medium text-foreground hover:text-primary hover:underline"
            >
              {u.full_name ?? u.email}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      </td>
      {/* Plan + admin badge */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
              planClass,
            )}
          >
            {planName}
          </span>
          {u.is_admin && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-700">
              <ShieldCheck className="h-2.5 w-2.5" />
              Admin
            </span>
          )}
        </div>
      </td>
      {/* KYC level — 4 dots (0..3 filled) */}
      <td className="px-4 py-3">
        <KycDots level={u.kyc_level} />
      </td>
      {/* Status — suspended takes priority */}
      <td className="px-4 py-3">
        {u.suspended ? (
          <StatusBadge status="failed" />
        ) : (
          <StatusBadge status={u.subscription_status || "active"} />
        )}
      </td>
      {/* Lifetime revenue */}
      <td className="px-4 py-3 text-right">
        <span className="font-mono text-sm text-foreground">
          ₹{u.total_revenue.toLocaleString("en-IN")}
        </span>
      </td>
      {/* Joined date */}
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {formatDate(u.created_at)}
      </td>
      {/* Row actions */}
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="User actions"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
              {u.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/admin/users/${u.id}`}>
                <UserCheck className="mr-2 h-3.5 w-3.5" /> View profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/users/${u.id}#change-plan`}>
                <Sparkles className="mr-2 h-3.5 w-3.5" /> Change plan
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              asChild
              className={u.suspended ? "" : "text-rose-600 focus:text-rose-700"}
            >
              <Link href={`/admin/users/${u.id}#suspend`}>
                <UserX className="mr-2 h-3.5 w-3.5" />
                {u.suspended ? "Restore" : "Suspend"}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function KycDots({ level }: { level: number }) {
  const lvl = Math.max(0, Math.min(3, level));
  return (
    <div
      className="inline-flex items-center gap-1"
      title={`KYC level ${lvl} of 3`}
    >
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "h-2 w-2 rounded-full transition-colors",
            i <= lvl
              ? lvl === 3
                ? "bg-emerald-500"
                : "bg-indigo-500"
              : "bg-muted",
          )}
        />
      ))}
      <span className="ml-1 text-xs font-medium text-muted-foreground">
        L{lvl}
      </span>
    </div>
  );
}
