"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Search } from "lucide-react";

import { retryTranscodeAction } from "@/actions/transcodes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export interface TranscodeRow {
  rawPath: string;
  status: string;
  segCount: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "default",
  processing: "secondary",
  failed: "destructive",
};

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={"font-sora text-2xl font-semibold " + tone}>{value.toLocaleString("en-IN")}</p>
    </div>
  );
}

export function AdminTranscodesClient({
  rows,
  counts,
}: {
  rows: TranscodeRow[];
  counts: { processing: number; ready: number; failed: number };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "processing" | "ready" | "failed">("all");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "all" || r.status === filter) &&
        (!t || r.rawPath.toLowerCase().includes(t)),
    );
  }, [rows, q, filter]);

  function retry(rawPath: string) {
    start(async () => {
      const res = await retryTranscodeAction(rawPath);
      toast(
        res.ok
          ? { title: "Re-queued", description: "Transcoding again — refresh in a moment." }
          : { variant: "destructive", title: "Couldn't retry", description: res.message },
      );
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Stat label="Ready" value={counts.ready} tone="text-emerald-600" />
        <Stat label="Processing" value={counts.processing} tone="text-amber-600" />
        <Stat label="Failed" value={counts.failed} tone="text-rose-600" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search by path" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {(["all", "ready", "processing", "failed"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
              {f}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No transcodes.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Video</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Segments</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.rawPath}>
                  <TableCell className="max-w-[260px]">
                    <span className="block truncate font-mono text-xs" title={r.rawPath}>
                      {r.rawPath.replace(/^course\//, "")}
                    </span>
                    {r.status === "failed" && r.error && (
                      <span className="block truncate text-xs text-rose-500" title={r.error}>
                        {r.error}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"} className="capitalize">
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.segCount ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{fmt(r.updatedAt ?? r.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {r.status === "failed" ? (
                      <Button variant="outline" size="sm" onClick={() => retry(r.rawPath)} disabled={pending}>
                        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                        Retry
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
