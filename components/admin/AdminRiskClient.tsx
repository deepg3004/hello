"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Ban,
  Check,
  Loader2,
  ShieldX,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

import {
  addBlocklistAction,
  blockFromOrderAction,
  clearOrderFlagAction,
  removeBlocklistAction,
  updateRiskThresholdsAction,
  type ThresholdKey,
} from "@/actions/risk";
import type { BlocklistEntry, BlocklistKind } from "@/lib/risk/blocklist";

export interface RiskFlagChip {
  code: string;
  label: string;
}

export interface FlaggedOrder {
  id: string;
  email: string;
  phone: string | null;
  ip: string | null;
  amount: number;
  currency: string;
  status: string;
  score: number;
  flags: RiskFlagChip[];
  flaggedAt: string | null;
}

interface Props {
  flagged: FlaggedOrder[];
  blocklist: BlocklistEntry[];
  thresholds: Record<ThresholdKey, number>;
}

const THRESHOLD_FIELDS: { key: ThresholdKey; label: string; hint: string }[] = [
  { key: "risk_flag_threshold", label: "Flag at score ≥", hint: "Min weighted score to flag an order." },
  { key: "risk_velocity_email_per_hour", label: "Email / hour", hint: "Orders from one email in 1h before flag." },
  { key: "risk_velocity_ip_per_hour", label: "IP / hour", hint: "Orders from one IP in 1h before flag." },
  { key: "risk_high_value_inr", label: "High value ₹", hint: "Amount that counts as high-value." },
  { key: "risk_duplicate_window_min", label: "Duplicate window (min)", hint: "Same email+product+amount window." },
];

export function AdminRiskClient({ flagged, blocklist, thresholds }: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  // ── Blocklist add form ──────────────────────────────────────────────────
  const [kind, setKind] = useState<BlocklistKind>("email");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  // ── Thresholds form ─────────────────────────────────────────────────────
  const [thr, setThr] = useState<Record<ThresholdKey, number>>(thresholds);

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast({ variant: "destructive", title: "Action failed", description: res.message });
      } else {
        toast({ title: okMsg });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Review queue ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Flagged orders ({flagged.length})
          </CardTitle>
          <CardDescription>
            Auto-flagged at checkout. Flagging never blocks a payment — review,
            then clear or block the offender.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {flagged.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No orders are awaiting review. 🎉
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer / IP</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Signals</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flagged.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="align-top">
                      <div className="font-medium">{o.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.ip ?? "no ip"} · {o.status}
                        {o.flaggedAt ? ` · ${format(new Date(o.flaggedAt), "dd MMM, HH:mm")}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="align-top whitespace-nowrap">
                      ₹{o.amount.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex max-w-[260px] flex-wrap gap-1">
                        {o.flags.map((f) => (
                          <span
                            key={f.code}
                            className="inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400"
                          >
                            {f.label}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <span className="inline-flex rounded-md bg-rose-500/10 px-2 py-0.5 text-sm font-semibold text-rose-600 dark:text-rose-400">
                        {o.score}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => run(() => clearOrderFlagAction(o.id), "Order cleared")}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" /> Clear
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => run(() => blockFromOrderAction(o.id, "email"), "Email blocked")}
                        >
                          <Ban className="mr-1 h-3.5 w-3.5" /> Email
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending || !o.ip}
                          onClick={() => run(() => blockFromOrderAction(o.id, "ip"), "IP blocked")}
                        >
                          <Ban className="mr-1 h-3.5 w-3.5" /> IP
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Blocklist manager ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldX className="h-4 w-4 text-rose-500" />
            Blocklist ({blocklist.length})
          </CardTitle>
          <CardDescription>
            Emails, IPs and phones here are hard-blocked from checkout before any
            gateway call. Fails open if the lookup errors.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-[120px_1fr_1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="bl-kind" className="text-xs">Type</Label>
              <select
                id="bl-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as BlocklistKind)}
                className="mt-1 h-10 w-full rounded-[10px] border border-input bg-background px-3 text-sm"
              >
                <option value="email">Email</option>
                <option value="ip">IP</option>
                <option value="phone">Phone</option>
              </select>
            </div>
            <div>
              <Label htmlFor="bl-value" className="text-xs">Value</Label>
              <Input
                id="bl-value"
                className="mt-1"
                placeholder={kind === "email" ? "buyer@example.com" : kind === "ip" ? "1.2.3.4" : "9198…"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bl-reason" className="text-xs">Reason (optional)</Label>
              <Input
                id="bl-reason"
                className="mt-1"
                placeholder="Chargeback fraud"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <Button
              disabled={pending || !value.trim()}
              onClick={() =>
                run(async () => {
                  const r = await addBlocklistAction(kind, value, reason);
                  if (r.ok) { setValue(""); setReason(""); }
                  return r;
                }, "Added to blocklist")
              }
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Block"}
            </Button>
          </div>

          {blocklist.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocklist.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="capitalize">{b.kind}</TableCell>
                    <TableCell className="font-mono text-xs">{b.value}</TableCell>
                    <TableCell className="text-muted-foreground">{b.reason ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(b.created_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => run(() => removeBlocklistAction(b.id), "Removed")}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Thresholds ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scoring thresholds</CardTitle>
          <CardDescription>
            Tune how aggressively checkout flags orders. Higher = fewer flags.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {THRESHOLD_FIELDS.map((f) => (
              <div key={f.key}>
                <Label htmlFor={f.key} className="text-xs">{f.label}</Label>
                <Input
                  id={f.key}
                  type="number"
                  min={0}
                  className="mt-1"
                  value={thr[f.key]}
                  onChange={(e) =>
                    setThr((t) => ({ ...t, [f.key]: Number(e.target.value) }))
                  }
                />
                <p className="mt-1 text-[11px] text-muted-foreground">{f.hint}</p>
              </div>
            ))}
          </div>
          <Button
            disabled={pending}
            onClick={() => run(() => updateRiskThresholdsAction(thr), "Thresholds saved")}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save thresholds"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
