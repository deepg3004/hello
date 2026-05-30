"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Copy, Loader2, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";

import {
  deleteCouponAction,
  duplicateCouponAction,
  toggleCouponActiveAction,
} from "@/actions/coupons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CouponDialog } from "./CouponDialog";

export interface CouponRow {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order: number;
  max_discount: number | null;
  total_limit: number | null;
  per_customer_limit: number;
  usage_count: number;
  starts_at: string | null;
  expires_at: string | null;
  page_ids: string[];
  active: boolean;
  created_at: string;
}

interface CouponsTableProps {
  coupons: CouponRow[];
  pages: Array<{ id: string; title: string }>;
}

export function CouponsTable({ coupons, pages }: CouponsTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const now = useMemo(() => Date.now(), []);
  const enriched = useMemo(
    () =>
      coupons.map((c) => {
        const expired = c.expires_at ? Date.parse(c.expires_at) < now : false;
        const depleted =
          c.total_limit !== null && c.usage_count >= c.total_limit;
        return { ...c, expired, depleted };
      }),
    [coupons, now],
  );

  async function toggleActive(c: CouponRow) {
    setBusy(`active-${c.id}`);
    const r = await toggleCouponActiveAction(c.id);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't toggle", description: r.message, variant: "destructive" });
      return;
    }
    router.refresh();
  }

  async function duplicate(id: string) {
    setBusy(`dup-${id}`);
    const r = await duplicateCouponAction(id);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Duplicate failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Duplicated", description: "Saved as inactive — edit the code first." });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this coupon? This cannot be undone.")) return;
    setBusy(`del-${id}`);
    const r = await deleteCouponAction(id);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Delete failed", description: r.message, variant: "destructive" });
      return;
    }
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {coupons.length} coupon{coupons.length === 1 ? "" : "s"}
            </p>
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" /> New coupon
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No coupons yet. Click <strong>New coupon</strong> to create your first.
                    </TableCell>
                  </TableRow>
                ) : (
                  enriched.map((c) => {
                    const status = !c.active
                      ? "inactive"
                      : c.expired
                        ? "expired"
                        : c.depleted
                          ? "depleted"
                          : "active";
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{c.code}</code>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {c.page_ids.length === 0
                              ? "All pages"
                              : `${c.page_ids.length} page${c.page_ids.length === 1 ? "" : "s"}`}
                          </p>
                        </TableCell>
                        <TableCell>
                          {c.discount_type === "percentage"
                            ? `${c.discount_value}%${c.max_discount ? ` · max ₹${c.max_discount}` : ""}`
                            : `₹${c.discount_value}`}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.usage_count} / {c.total_limit ?? "∞"}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.expires_at ? format(new Date(c.expires_at), "d MMM yyyy") : "—"}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={c.active}
                            onCheckedChange={() => toggleActive(c)}
                            disabled={busy === `active-${c.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                {busy?.startsWith("dup-") && busy.endsWith(c.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onSelect={() => setEditing(c)}>
                                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => duplicate(c.id)}>
                                <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => remove(c.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CouponDialog open={creating} onOpenChange={setCreating} pages={pages} />
      <CouponDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        pages={pages}
        initial={editing ?? undefined}
      />
    </>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800",
    inactive: "bg-zinc-200 text-zinc-700",
    expired: "bg-zinc-200 text-zinc-600",
    depleted: "bg-amber-100 text-amber-800",
  };
  return (
    <Badge variant="outline" className={`border-transparent capitalize ${map[status] ?? ""}`}>
      {status}
    </Badge>
  );
}
