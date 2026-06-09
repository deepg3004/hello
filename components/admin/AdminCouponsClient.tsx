"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import { adminToggleCouponAction } from "@/actions/admin";
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
import { cn, formatDate } from "@/lib/utils";

export interface AdminCouponRow {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  total_limit: number | null;
  usage_count: number;
  expires_at: string | null;
  active: boolean;
  page_scoped: boolean;
  seller_name: string;
  seller_email: string;
}

export function AdminCouponsClient({ rows }: { rows: AdminCouponRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<"all" | "active" | "disabled">("all");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === "active" && !r.active) return false;
      if (status === "disabled" && r.active) return false;
      if (!s) return true;
      return (
        r.code.toLowerCase().includes(s) ||
        r.seller_name.toLowerCase().includes(s) ||
        r.seller_email.toLowerCase().includes(s)
      );
    });
  }, [rows, q, status]);

  async function toggle(r: AdminCouponRow) {
    if (!confirm(`${r.active ? "Disable" : "Enable"} coupon ${r.code}?`)) return;
    setBusy(r.id);
    const res = await adminToggleCouponAction(r.id, !r.active);
    setBusy(null);
    if (!res.ok) {
      toast({ title: "Failed", description: res.message, variant: "destructive" });
      return;
    }
    toast({ title: res.message });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, seller, email…"
            className="pl-8"
          />
        </div>
        {(["all", "active", "disabled"] as const).map((s) => (
          <Button
            key={s}
            variant={status === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatus(s)}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No coupons.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs font-semibold">
                    {r.code}
                    {r.page_scoped && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">(page)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{r.seller_name}</div>
                    <div className="text-xs text-muted-foreground">{r.seller_email}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.discount_type === "percentage"
                      ? `${r.discount_value}%`
                      : `₹${r.discount_value}`}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.usage_count}
                    {r.total_limit != null ? ` / ${r.total_limit}` : ""}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.expires_at ? formatDate(r.expires_at) : "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                        r.active
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {r.active ? "active" : "disabled"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={r.active ? "outline" : "default"}
                      size="sm"
                      onClick={() => toggle(r)}
                      disabled={busy === r.id}
                    >
                      {busy === r.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      {r.active ? "Disable" : "Enable"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
