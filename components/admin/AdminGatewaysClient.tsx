"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Search } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { setGatewayStatusAction } from "@/actions/admin-wallet";

export interface AdminGatewayRow {
  sellerUserId: string;
  sellerName: string;
  sellerEmail: string;
  gatewayType: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

export function AdminGatewaysClient({ rows }: { rows: AdminGatewayRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");

  const types = useMemo(
    () => Array.from(new Set(rows.map((r) => r.gatewayType))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (type && r.gatewayType !== type) return false;
      if (!s) return true;
      return (
        r.sellerName.toLowerCase().includes(s) ||
        r.sellerEmail.toLowerCase().includes(s)
      );
    });
  }, [rows, search, type]);

  function toggle(
    row: AdminGatewayRow,
    field: "is_active" | "is_verified",
    next: boolean,
  ) {
    startTransition(async () => {
      const res = await setGatewayStatusAction({
        sellerId: row.sellerUserId,
        [field]: next,
      });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't update", description: res.message });
        return;
      }
      toast({ title: "Gateway updated" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="card-surface flex flex-wrap items-center gap-3 p-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder="Search seller name or email…"
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">All gateways</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="card-surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="th-label">Seller</TableHead>
              <TableHead className="th-label">Gateway</TableHead>
              <TableHead className="th-label">Active</TableHead>
              <TableHead className="th-label">Verified</TableHead>
              <TableHead className="th-label">Connected</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  No gateway connections match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.sellerUserId} className="hover:bg-muted/30">
                  <TableCell>
                    <Link href={`/admin/users/${r.sellerUserId}`} className="hover:underline">
                      {r.sellerName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{r.sellerEmail}</div>
                  </TableCell>
                  <TableCell className="capitalize">{r.gatewayType}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={r.isActive ? "default" : "outline"}
                      disabled={pending}
                      onClick={() => toggle(r, "is_active", !r.isActive)}
                    >
                      {r.isActive ? "Active" : "Inactive"}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={r.isVerified ? "default" : "outline"}
                      disabled={pending}
                      onClick={() => toggle(r, "is_verified", !r.isVerified)}
                    >
                      {r.isVerified ? "Verified" : "Unverified"}
                    </Button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(r.createdAt), "d MMM yyyy")}
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
