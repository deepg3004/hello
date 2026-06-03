"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Coins, IndianRupee, AlertTriangle, Search, Loader2 } from "lucide-react";

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
import { cn, formatINR } from "@/lib/utils";
import { adjustSellerWalletAction } from "@/actions/admin-wallet";

const LOW_BALANCE_PAISE = 20000; // ₹200

export interface WalletFeeSummary {
  totalFeesPaise: number;
  monthFeesPaise: number;
  lowBalanceSellers: number;
}
export interface AdminWalletRow {
  sellerUserId: string;
  sellerName: string;
  sellerEmail: string;
  balancePaise: number;
  lastLowBalanceAlertAt: string | null;
}
export interface AdminWalletTxn {
  id: string;
  sellerName: string;
  type: "credit" | "debit";
  amountPaise: number;
  description: string;
  balanceAfter: number;
  createdAt: string;
}

export function AdminWalletsClient({
  summary,
  wallets,
  recentTxns,
}: {
  summary: WalletFeeSummary;
  wallets: AdminWalletRow[];
  recentTxns: AdminWalletTxn[];
}) {
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return wallets.filter((w) => {
      if (lowOnly && w.balancePaise > LOW_BALANCE_PAISE) return false;
      if (!s) return true;
      return (
        w.sellerName.toLowerCase().includes(s) ||
        w.sellerEmail.toLowerCase().includes(s)
      );
    });
  }, [wallets, search, lowOnly]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniStat
          label="Fees collected (all-time)"
          value={formatINR(summary.totalFeesPaise)}
          tile="tile-emerald"
          Icon={IndianRupee}
        />
        <MiniStat
          label="Fees this month"
          value={formatINR(summary.monthFeesPaise)}
          tile="tile-indigo"
          Icon={Coins}
        />
        <MiniStat
          label="Low-balance sellers"
          value={summary.lowBalanceSellers.toLocaleString("en-IN")}
          tile="tile-amber"
          Icon={AlertTriangle}
        />
      </div>

      <div className="card-surface flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              placeholder="Search seller name or email…"
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(e) => setLowOnly(e.target.checked)}
            />
            Low balance only
          </label>
        </div>
      </div>

      <div className="card-surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="th-label">Seller</TableHead>
              <TableHead className="th-label text-right">Balance</TableHead>
              <TableHead className="th-label">Last low-balance alert</TableHead>
              <TableHead className="th-label text-right">Adjust</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                  No wallets match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((w) => {
                const low = w.balancePaise <= LOW_BALANCE_PAISE;
                const open = openId === w.sellerUserId;
                return (
                  <Fragment key={w.sellerUserId}>
                    <TableRow className="hover:bg-muted/30">
                      <TableCell>
                        <Link
                          href={`/admin/users/${w.sellerUserId}`}
                          className="hover:underline"
                        >
                          {w.sellerName}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {w.sellerEmail}
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono",
                          low && "text-amber-600",
                        )}
                      >
                        {formatINR(w.balancePaise)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {w.lastLowBalanceAlertAt
                          ? format(new Date(w.lastLowBalanceAlertAt), "d MMM yyyy, HH:mm")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setOpenId(open ? null : w.sellerUserId)}
                        >
                          {open ? "Close" : "Adjust"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={4}>
                          <AdjustForm
                            sellerId={w.sellerUserId}
                            sellerName={w.sellerName}
                            onDone={() => setOpenId(null)}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="card-surface overflow-x-auto">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">
          Recent wallet activity
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="th-label">Seller</TableHead>
              <TableHead className="th-label">Description</TableHead>
              <TableHead className="th-label text-right">Amount</TableHead>
              <TableHead className="th-label text-right">Balance after</TableHead>
              <TableHead className="th-label">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentTxns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No wallet activity yet.
                </TableCell>
              </TableRow>
            ) : (
              recentTxns.map((t) => (
                <TableRow key={t.id} className="hover:bg-muted/30">
                  <TableCell>{t.sellerName}</TableCell>
                  <TableCell className="text-muted-foreground">{t.description}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono",
                      t.type === "credit" ? "text-emerald-600" : "text-foreground",
                    )}
                  >
                    {t.type === "credit" ? "+" : "−"}
                    {formatINR(t.amountPaise)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatINR(t.balanceAfter)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(t.createdAt), "d MMM, HH:mm")}
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

function AdjustForm({
  sellerId,
  sellerName,
  onDone,
}: {
  sellerId: string;
  sellerName: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"credit" | "debit">("credit");
  const [rupees, setRupees] = useState("");
  const [note, setNote] = useState("");

  function apply() {
    const amt = Number(rupees);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ variant: "destructive", title: "Enter a valid amount" });
      return;
    }
    const deltaPaise = Math.round(amt * 100) * (mode === "credit" ? 1 : -1);
    startTransition(async () => {
      const res = await adjustSellerWalletAction({
        sellerId,
        deltaPaise,
        description: note || undefined,
      });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't adjust", description: res.message });
        return;
      }
      toast({
        title: "Wallet updated",
        description: `${mode === "credit" ? "Credited" : "Debited"} ${formatINR(Math.abs(deltaPaise))} — ${sellerName}.`,
      });
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 py-1">
      <div>
        <label className="block text-xs text-muted-foreground">Type</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "credit" | "debit")}
          className="mt-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="credit">Credit (+)</option>
          <option value="debit">Debit (−)</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground">Amount (₹)</label>
        <Input
          value={rupees}
          onChange={(e) => setRupees(e.target.value)}
          placeholder="500"
          inputMode="decimal"
          className="mt-1 h-9 w-32"
        />
      </div>
      <div className="flex-1 min-w-40">
        <label className="block text-xs text-muted-foreground">Note (optional)</label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason for adjustment"
          className="mt-1 h-9"
        />
      </div>
      <Button onClick={apply} disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Apply
      </Button>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tile,
  Icon,
}: {
  label: string;
  value: string;
  tile: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="card-surface flex items-center gap-3 p-4">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", tile)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}
