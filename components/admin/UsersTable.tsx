"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Search } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { PLANS } from "@/lib/plans";

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

export function UsersTable({ users }: { users: AdminUserRow[] }) {
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [kyc, setKyc] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !u.email.toLowerCase().includes(q) && !u.full_name?.toLowerCase().includes(q))
        return false;
      if (plan !== "all" && u.subscription_plan !== plan) return false;
      if (kyc !== "all" && String(u.kyc_level) !== kyc) return false;
      return true;
    });
  }, [users, search, plan, kyc]);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or email"
              className="pl-9"
            />
          </div>
          <div>
            <Label className="text-xs">Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger>
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
          <div>
            <Label className="text-xs">KYC level</Label>
            <Select value={kyc} onValueChange={setKyc}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="0">0 — none</SelectItem>
                <SelectItem value="1">1 — email</SelectItem>
                <SelectItem value="2">2 — bank</SelectItem>
                <SelectItem value="3">3 — full</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No users match the filter.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => {
                  const planName = (PLANS as Record<string, { name: string }>)[u.subscription_plan]?.name ?? "Free";
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">
                          {u.full_name ?? u.email}
                        </Link>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={u.subscription_plan === "free" ? "outline" : "default"}>
                            {planName}
                          </Badge>
                          {u.is_admin && (
                            <Badge className="bg-amber-400 text-zinc-950 hover:bg-amber-400">Admin</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">Level {u.kyc_level}</Badge>
                      </TableCell>
                      <TableCell>
                        {u.suspended ? (
                          <StatusBadge status="suspended" />
                        ) : (
                          <StatusBadge status={u.subscription_status} />
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ₹{u.total_revenue.toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(u.created_at), "d MMM yyyy")}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {users.length}
        </p>
      </CardContent>
    </Card>
  );
}
