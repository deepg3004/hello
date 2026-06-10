"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Globe, Link2, Loader2, RefreshCw, Search, ShieldCheck, Unlink } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  adminReVerifyCustomDomainAction,
  adminReleaseCustomDomainAction,
} from "@/actions/domains";

export interface AdminDomainRow {
  userId: string;
  seller: string;
  email: string;
  subdomain: string | null;
  subdomainClaimedAt: string | null;
  customDomain: string | null;
  customVerifiedAt: string | null;
  certStatus: string | null;
  lastError: string | null;
}

const CERT_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  provisioning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  failed: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export function AdminDomainsClient({ rows }: { rows: AdminDomainRow[] }) {
  const [search, setSearch] = useState("");
  const [onlyCustom, setOnlyCustom] = useState(false);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyCustom && !r.customDomain) return false;
      if (!s) return true;
      return (
        (r.subdomain?.toLowerCase().includes(s) ?? false) ||
        (r.customDomain?.toLowerCase().includes(s) ?? false) ||
        r.seller.toLowerCase().includes(s) ||
        r.email.toLowerCase().includes(s)
      );
    });
  }, [rows, search, onlyCustom]);

  const summary = useMemo(() => {
    let custom = 0;
    let live = 0;
    for (const r of rows) {
      if (r.customDomain) custom += 1;
      if (r.certStatus === "active") live += 1;
    }
    return { subs: rows.length, custom, live };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MiniStat label="With a domain" value={summary.subs.toLocaleString("en-IN")} tile="tile-indigo" icon={Globe} />
        <MiniStat label="Custom domains" value={summary.custom.toLocaleString("en-IN")} tile="tile-violet" icon={Link2} />
        <MiniStat label="Live certs" value={summary.live.toLocaleString("en-IN")} tile="tile-emerald" icon={ShieldCheck} />
      </div>

      <div className="card-surface flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder="Search subdomain, domain or seller…"
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyCustom} onChange={(e) => setOnlyCustom(e.target.checked)} />
          Custom domains only
        </label>
      </div>

      <div className="card-surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="th-label">Seller</TableHead>
              <TableHead className="th-label">Subdomain</TableHead>
              <TableHead className="th-label">Custom domain</TableHead>
              <TableHead className="th-label">Cert</TableHead>
              <TableHead className="th-label">Last error</TableHead>
              <TableHead className="th-label text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No domains yet." : "No matches."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.userId} className="transition-colors hover:bg-muted/30">
                  <TableCell>
                    <Link href={`/admin/users/${r.userId}`} className="hover:underline">
                      {r.seller}
                    </Link>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.subdomain ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.customDomain ?? "—"}</TableCell>
                  <TableCell>
                    {r.customDomain ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                          CERT_TONE[r.certStatus ?? ""] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {r.certStatus ?? "—"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate text-xs text-rose-600" title={r.lastError ?? ""}>
                    {r.lastError ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.customDomain ? (
                      <RowActions userId={r.userId} domain={r.customDomain} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Showing {filtered.length.toLocaleString("en-IN")} of{" "}
        {rows.length.toLocaleString("en-IN")} sellers with a domain.
      </p>
    </div>
  );
}

function RowActions({ userId, domain }: { userId: string; domain: string }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function run(
    fn: () => Promise<{ ok: boolean; message?: string }>,
    okTitle: string,
  ) {
    startTransition(async () => {
      const r = await fn();
      toast({
        title: r.ok ? okTitle : "Action failed",
        description: r.message,
        variant: r.ok ? undefined : "destructive",
      });
    });
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => adminReVerifyCustomDomainAction(userId), "Re-verify run")}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
        Re-verify
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
        onClick={() => {
          if (!confirm(`Release ${domain}? The seller will need to re-add and re-verify it.`)) return;
          run(() => adminReleaseCustomDomainAction(userId), "Domain released");
        }}
      >
        <Unlink className="mr-1 h-3.5 w-3.5" />
        Release
      </Button>
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
  icon: typeof Globe;
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
