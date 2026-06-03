"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowUpDown,
  CheckCircle2,
  Download,
  Gift,
  Loader2,
  Mail,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

import { broadcastEmailAction, deleteLeadsAction } from "@/actions/leads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { LeadDetailDrawer } from "./LeadDetailDrawer";

export interface LeadRow {
  id: string;
  page_id: string | null;
  page_title: string | null;
  name: string | null;
  email: string;
  phone: string | null;
  tags: string[];
  notes: Array<{ body: string; by: string; at: string }>;
  custom_fields: Record<string, unknown>;
  source: string | null;
  utm: Record<string, string> | null;
  confirmed_at: string | null;
  delivered_magnet: boolean;
  created_at: string;
}

interface LeadsTableProps {
  leads: LeadRow[];
  pages: Array<{ id: string; title: string }>;
}

const PAGE_SIZE = 25;

const csvEscape = (s: unknown) => {
  const v = s == null ? "" : String(s);
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

export function LeadsTable({ leads, pages }: LeadsTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [pageFilter, setPageFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [segment, setSegment] = useState<"all" | "confirmed" | "unconfirmed" | "delivered">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<LeadRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState<"delete" | "broadcast" | null>(null);
  const [bcastSubject, setBcastSubject] = useState("");
  const [bcastBody, setBcastBody] = useState("");

  // Summary cards reflect the full snapshot.
  const summary = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    return {
      total: leads.length,
      confirmed: leads.filter((l) => l.confirmed_at).length,
      delivered: leads.filter((l) => l.delivered_magnet).length,
      newThisWeek: leads.filter((l) => Date.parse(l.created_at) > weekAgo).length,
    };
  }, [leads]);

  // Base set honours search / page / date filters (but NOT the segment chip).
  // Chip counts and the table both derive from this.
  const base = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (q && !l.email.toLowerCase().includes(q) && !l.name?.toLowerCase().includes(q))
        return false;
      if (pageFilter !== "all" && l.page_id !== pageFilter) return false;
      if (from && new Date(l.created_at) < new Date(from)) return false;
      if (to) {
        const t = new Date(to);
        t.setHours(23, 59, 59, 999);
        if (new Date(l.created_at) > t) return false;
      }
      return true;
    });
  }, [leads, search, pageFilter, from, to]);

  const segmentCounts = useMemo(
    () => ({
      all: base.length,
      confirmed: base.filter((l) => l.confirmed_at).length,
      unconfirmed: base.filter((l) => !l.confirmed_at).length,
      delivered: base.filter((l) => l.delivered_magnet).length,
    }),
    [base],
  );

  const filtered = useMemo(() => {
    const bySegment = base.filter((l) => {
      if (segment === "confirmed") return !!l.confirmed_at;
      if (segment === "unconfirmed") return !l.confirmed_at;
      if (segment === "delivered") return l.delivered_magnet;
      return true;
    });
    const sorted = [...bySegment];
    sorted.sort((a, b) => {
      if (sort === "oldest")
        return Date.parse(a.created_at) - Date.parse(b.created_at);
      if (sort === "name")
        return (a.name ?? a.email).localeCompare(b.name ?? b.email, undefined, {
          sensitivity: "base",
        });
      return Date.parse(b.created_at) - Date.parse(a.created_at);
    });
    return sorted;
  }, [base, segment, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allSliceSelected =
    slice.length > 0 && slice.every((l) => selected.has(l.id));

  function toggleOne(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  }
  function toggleAllSlice(on: boolean) {
    const next = new Set(selected);
    for (const l of slice) {
      if (on) next.add(l.id);
      else next.delete(l.id);
    }
    setSelected(next);
  }

  function exportCsv() {
    const header = ["created_at", "name", "email", "phone", "page", "tags", "source"];
    const lines = [header.join(",")];
    for (const l of filtered) {
      lines.push(
        [
          l.created_at,
          l.name ?? "",
          l.email,
          l.phone ?? "",
          l.page_title ?? "",
          l.tags.join("|"),
          l.source ?? "",
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoxai-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} lead${selected.size === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setBusy("delete");
    const r = await deleteLeadsAction(Array.from(selected));
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Delete failed", description: r.message, variant: "destructive" });
      return;
    }
    setSelected(new Set());
    router.refresh();
  }

  async function broadcast() {
    if (!bcastSubject.trim() || !bcastBody.trim()) {
      toast({ title: "Subject and body required", variant: "destructive" });
      return;
    }
    setBusy("broadcast");
    const r = await broadcastEmailAction(Array.from(selected), bcastSubject, bcastBody);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Broadcast failed", description: r.message, variant: "destructive" });
      return;
    }
    const sent = ((r.data as Record<string, unknown> | undefined)?.sent as number | undefined) ?? 0;
    toast({ title: "Broadcast sent", description: `${sent} emails dispatched` });
    setBcastSubject("");
    setBcastBody("");
  }

  function openLead(lead: LeadRow) {
    setActive(lead);
    setDrawerOpen(true);
  }

  const STAT_CARDS = [
    { label: "Total leads", value: summary.total, tile: "tile-indigo", Icon: Users },
    { label: "Confirmed", value: summary.confirmed, tile: "tile-emerald", Icon: CheckCircle2 },
    { label: "Magnet delivered", value: summary.delivered, tile: "tile-violet", Icon: Gift },
    { label: "New this week", value: summary.newThisWeek, tile: "tile-amber", Icon: Sparkles },
  ] as const;

  const SEGMENTS = [
    { key: "all", label: "All", count: segmentCounts.all },
    { key: "confirmed", label: "Confirmed", count: segmentCounts.confirmed },
    { key: "unconfirmed", label: "Unconfirmed", count: segmentCounts.unconfirmed },
    { key: "delivered", label: "Delivered", count: segmentCounts.delivered },
  ] as const;

  return (
    <>
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAT_CARDS.map(({ label, value, tile, Icon }) => (
          <div
            key={label}
            className="card-surface flex items-center gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-md"
          >
            <div className={`${tile} flex h-10 w-10 shrink-0 items-center justify-center rounded-xl`}>
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
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          {/* Segment chips + sort */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {SEGMENTS.map(({ key, label, count }) => {
                const isActive = segment === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setPage(1);
                      setSegment(key);
                    }}
                    className={
                      isActive
                        ? "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300"
                        : "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    }
                  >
                    {label}
                    <span
                      className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                        isActive ? "bg-white/15" : "bg-muted"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="name">Name A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filter bar */}
          <div className="grid gap-3 md:grid-cols-5">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                placeholder="Name or email"
                className="pl-9"
              />
            </div>
            <div>
              <Label className="text-xs">Page</Label>
              <Select
                value={pageFilter}
                onValueChange={(v) => {
                  setPage(1);
                  setPageFilter(v);
                }}
              >
                <SelectTrigger>
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
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          {/* Bulk action bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
            <p className="text-muted-foreground">
              {selected.size === 0
                ? `${filtered.length} lead${filtered.length === 1 ? "" : "s"}`
                : `${selected.size} selected`}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Export CSV
              </Button>
              {selected.size > 0 && (
                <>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Mail className="mr-2 h-3.5 w-3.5" />
                        Broadcast email
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Email {selected.size} selected lead{selected.size === 1 ? "" : "s"}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label>Subject</Label>
                          <Input
                            value={bcastSubject}
                            onChange={(e) => setBcastSubject(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Message</Label>
                          <Textarea
                            rows={6}
                            value={bcastBody}
                            onChange={(e) => setBcastBody(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={broadcast} disabled={busy === "broadcast"}>
                          {busy === "broadcast" && (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          )}
                          Send
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={bulkDelete}
                    disabled={busy === "delete"}
                  >
                    {busy === "delete" ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                    )}
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={allSliceSelected}
                      onCheckedChange={(v) => toggleAllSlice(!!v)}
                      aria-label="Select all on page"
                    />
                  </TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Captured</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slice.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No leads match the current filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  slice.map((l) => (
                    <TableRow
                      key={l.id}
                      className="cursor-pointer"
                      onClick={() => openLead(l)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(l.id)}
                          onCheckedChange={(v) => toggleOne(l.id, !!v)}
                          aria-label="Select"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{l.name ?? l.email}</div>
                        {l.name && (
                          <div className="text-xs text-muted-foreground">{l.email}</div>
                        )}
                        {l.phone && (
                          <div className="text-xs text-muted-foreground">{l.phone}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.page_title ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {l.tags.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            l.tags.map((t) => (
                              <Badge key={t} variant="outline" className="text-xs">
                                {t}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(l.created_at), "d MMM, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t pt-3 text-sm">
            <span className="text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <LeadDetailDrawer
        lead={active}
        open={drawerOpen}
        onOpenChange={(o) => {
          setDrawerOpen(o);
          if (!o) setActive(null);
        }}
      />
    </>
  );
}
