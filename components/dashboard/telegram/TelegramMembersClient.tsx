"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CalendarClock,
  Check,
  Copy,
  Download,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";

import {
  addMemberAction,
  regenerateMemberInviteAction,
  sellerBanMembershipAction,
  sellerConvertPlanAction,
  sellerRevokeMembershipAction,
  sellerSetJoinedAction,
} from "@/actions/telegram";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

export interface MemberRow {
  id: string;
  buyer_email: string;
  telegram_user_id: string | null;
  status: string;
  joined_at: string | null;
  expires_at: string | null;
  invited_at: string | null;
  invite_link: string | null;
}

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Joined" },
  { key: "invited", label: "Not joined" },
  { key: "expired", label: "Expired" },
  { key: "removed", label: "Removed" },
  { key: "banned", label: "Banned" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

const DURATIONS = [
  { label: "1 Month", days: 30 },
  { label: "3 Months", days: 90 },
  { label: "6 Months", days: 180 },
  { label: "1 Year", days: 365 },
  { label: "Lifetime", days: 0 },
];

export function TelegramMembersClient({
  rows,
  groupName,
  groupId,
}: {
  rows: MemberRow[];
  groupName: string;
  groupId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Add-member form
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState("");
  const [days, setDays] = useState(30);
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return (
        r.buyer_email.toLowerCase().includes(q) ||
        (r.telegram_user_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, status]);

  async function copyLink(id: string, link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  async function addMember() {
    setAdding(true);
    try {
      const res = await addMemberAction({ groupId, email, durationDays: days === 0 ? null : days });
      if (!res.ok || !res.data) throw new Error(res.message ?? "Failed");
      toast({ title: "Member added", description: "Invite link created — share it with them." });
      setEmail("");
      setShowAdd(false);
      router.refresh();
    } catch (e) {
      toast({ title: "Couldn't add member", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  async function regenerate(id: string) {
    setBusyId(id);
    try {
      const res = await regenerateMemberInviteAction(id);
      if (!res.ok || !res.data) throw new Error(res.message ?? "Failed");
      toast({ title: "New invite link generated" });
      router.refresh();
    } catch (e) {
      toast({ title: "Couldn't regenerate", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv() {
    const header = ["Email", "Telegram ID", "Status", "Joined", "Expires", "Invite link"];
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = filtered.map((r) =>
      [
        r.buyer_email,
        r.telegram_user_id ?? "",
        r.status === "active" ? "Joined" : r.status,
        r.joined_at ? formatDate(r.joined_at) : "",
        r.expires_at ? formatDate(r.expires_at) : "Lifetime",
        r.invite_link ?? "",
      ].map(esc).join(","),
    );
    const csv = [header.map(esc).join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `telegram-members-${groupName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "group"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email or Telegram ID" className="pl-8" />
          </div>
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => (
              <Button key={f.key} type="button" size="sm" variant={status === f.key ? "default" : "outline"} onClick={() => setStatus(f.key)}>
                {f.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button onClick={() => setShowAdd((s) => !s)}>
            <Plus className="mr-2 h-4 w-4" /> Add member
          </Button>
        </div>
      </div>

      {/* add-member form */}
      {showAdd && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Member email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Access</label>
              <select className="h-10 rounded-md border bg-background px-2 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {DURATIONS.map((d) => <option key={d.days} value={d.days}>{d.label}</option>)}
              </select>
            </div>
            <Button disabled={adding || !email.trim()} onClick={addMember}>
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create invite
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              {rows.length === 0 ? "No members yet. Buyers appear here after payment, or add one manually." : "No members match your search."}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2">Member</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Expires</th>
                  <th className="px-4 py-2">Invite link</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const joined = m.status === "active";
                  return (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{m.buyer_email}</div>
                        {m.telegram_user_id && <div className="font-mono text-xs text-muted-foreground">tg:{m.telegram_user_id}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={m.status} />
                        <div className={`mt-0.5 text-[11px] ${joined ? "text-emerald-600" : "text-amber-600"}`}>
                          {joined ? "✓ Joined" : m.status === "invited" ? "Not joined yet" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {m.expires_at ? formatDate(m.expires_at) : <Badge variant="outline">Lifetime</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        {m.invite_link ? (
                          <div className="flex items-center gap-1">
                            <code className="max-w-[160px] truncate rounded bg-muted/50 px-1.5 py-0.5 text-xs">{m.invite_link}</code>
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyLink(m.id, m.invite_link!)}>
                              {copiedId === m.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="outline" size="sm" disabled={busyId === m.id} onClick={() => regenerate(m.id)}>
                            {busyId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                            Invite
                          </Button>
                          <MemberActions member={m} onDone={() => router.refresh()} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length.toLocaleString("en-IN")} of {rows.length.toLocaleString("en-IN")} members.
      </p>
    </div>
  );
}

const CONVERT_DURATIONS = [
  { label: "1 Month", days: 30 },
  { label: "3 Months", days: 90 },
  { label: "6 Months", days: 180 },
  { label: "1 Year", days: 365 },
  { label: "Lifetime", days: 0 },
];

function MemberActions({
  member,
  onDone,
}: {
  member: MemberRow;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const joined = member.status === "active";

  const run = (
    fn: () => Promise<{ ok: boolean; message?: string }>,
    okMsg: string,
    confirmMsg?: string,
  ) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast({ title: "Action failed", description: res.message, variant: "destructive" });
        return;
      }
      toast({ title: okMsg });
      onDone();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
          <span className="sr-only">Manage member</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {joined ? (
          <DropdownMenuItem
            onClick={() =>
              run(() => sellerSetJoinedAction(member.id, false), "Marked as not joined")
            }
          >
            <UserX className="mr-2 h-4 w-4" /> Mark as not joined
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() =>
              run(() => sellerSetJoinedAction(member.id, true), "Marked as joined")
            }
          >
            <UserCheck className="mr-2 h-4 w-4" /> Mark as joined
          </DropdownMenuItem>
        )}

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CalendarClock className="mr-2 h-4 w-4" /> Convert plan
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {CONVERT_DURATIONS.map((d) => (
              <DropdownMenuItem
                key={d.days}
                onClick={() =>
                  run(
                    () => sellerConvertPlanAction(member.id, d.days),
                    `Plan set to ${d.label}`,
                  )
                }
              >
                {d.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-amber-600 focus:text-amber-600"
          onClick={() =>
            run(
              () => sellerRevokeMembershipAction(member.id),
              "Access revoked",
              `Revoke access for ${member.buyer_email}? They'll be removed from the channel but can rejoin on renewal.`,
            )
          }
        >
          <UserX className="mr-2 h-4 w-4" /> Revoke access
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-rose-600 focus:text-rose-600"
          onClick={() =>
            run(
              () => sellerBanMembershipAction(member.id),
              "Member banned",
              `Ban ${member.buyer_email}? They will be removed and blocked from rejoining until you unban them.`,
            )
          }
        >
          <Ban className="mr-2 h-4 w-4" /> Ban member
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
