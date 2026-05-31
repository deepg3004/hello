"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatDate } from "@/lib/utils";

export interface MemberRow {
  id: string;
  buyer_email: string;
  telegram_user_id: string | null;
  status: string;
  joined_at: string | null;
  expires_at: string | null;
  invited_at: string | null;
}

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "invited", label: "Invited" },
  { key: "expired", label: "Expired" },
  { key: "removed", label: "Removed" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

export function TelegramMembersClient({
  rows,
  groupName,
}: {
  rows: MemberRow[];
  groupName: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

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

  function exportCsv() {
    const header = ["Email", "Telegram user ID", "Status", "Joined", "Expires"];
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = filtered.map((r) =>
      [
        r.buyer_email,
        r.telegram_user_id ?? "",
        r.status,
        r.joined_at ? formatDate(r.joined_at) : "",
        r.expires_at ? formatDate(r.expires_at) : "Lifetime",
      ]
        .map(esc)
        .join(","),
    );
    const csv = [header.map(esc).join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = groupName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "group";
    a.href = url;
    a.download = `telegram-members-${safe}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search email or Telegram ID"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.key}
                type="button"
                size="sm"
                variant={status === f.key ? "default" : "outline"}
                onClick={() => setStatus(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              {rows.length === 0
                ? "No members yet. Buyers appear here automatically after payment."
                : "No members match your search."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="font-medium">{m.buyer_email}</div>
                      {m.telegram_user_id && (
                        <div className="font-mono text-xs text-muted-foreground">
                          tg:{m.telegram_user_id}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={m.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.joined_at ? formatDate(m.joined_at) : "—"}
                    </TableCell>
                    <TableCell>
                      {m.expires_at ? (
                        formatDate(m.expires_at)
                      ) : (
                        <Badge variant="outline">Lifetime</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length.toLocaleString("en-IN")} of{" "}
        {rows.length.toLocaleString("en-IN")} members.
      </p>
    </div>
  );
}
