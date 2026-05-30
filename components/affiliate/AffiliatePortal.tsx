"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  Wallet,
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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface PortalLink {
  id: string;
  referrer_name: string;
  referral_code: string;
  clicks: number;
  conversions: number;
  earnings: number;
  paid_amount: number;
  status: "active" | "paused";
  page_title: string;
  page_slug: string;
  page_status: string;
  commission_type: "percentage" | "fixed";
  commission_value: number;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_holder_name: string | null;
}

interface PortalPayout {
  id: string;
  affiliate_link_id: string;
  commission_amount: number;
  status: "pending" | "paid" | "cancelled";
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string;
  order_id: string;
}

interface Props {
  email: string;
  links: PortalLink[];
  payouts: PortalPayout[];
  baseUrl: string;
}

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function AffiliatePortal({ email, links, payouts, baseUrl }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const totals = useMemo(() => {
    const earnings = links.reduce((s, l) => s + l.earnings, 0);
    const paid = links.reduce((s, l) => s + l.paid_amount, 0);
    const clicks = links.reduce((s, l) => s + l.clicks, 0);
    const conv = links.reduce((s, l) => s + l.conversions, 0);
    return {
      earnings,
      paid,
      outstanding: earnings - paid,
      clicks,
      conv,
    };
  }, [links]);

  const firstWithBank =
    links.find((l) => l.bank_account_number) ?? links[0] ?? null;
  const [accountNumber, setAccountNumber] = useState(
    firstWithBank?.bank_account_number ?? "",
  );
  const [ifsc, setIfsc] = useState(firstWithBank?.bank_ifsc ?? "");
  const [holderName, setHolderName] = useState(
    firstWithBank?.bank_holder_name ?? "",
  );
  const [savingBank, setSavingBank] = useState(false);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied` });
    } catch {
      /* fall through */
    }
  }

  async function logout() {
    await fetch("/api/affiliate/portal/logout", { method: "POST" });
    router.refresh();
  }

  async function saveBank() {
    setSavingBank(true);
    try {
      const res = await fetch("/api/affiliate/portal/bank", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account_number: accountNumber,
          ifsc,
          holder_name: holderName,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't save",
          description: body.error,
        });
        return;
      }
      toast({ title: "Bank details saved" });
      router.refresh();
    } finally {
      setSavingBank(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            invoxai.io / affiliate / portal
          </p>
          <h1 className="text-2xl font-sora font-semibold tracking-tight">
            Your portal
          </h1>
          <p className="text-sm text-muted-foreground">
            Signed in as <strong>{email}</strong>
          </p>
        </div>
        <Button variant="outline" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Clicks" value={totals.clicks.toLocaleString("en-IN")} />
        <Stat label="Conversions" value={totals.conv.toLocaleString("en-IN")} />
        <Stat label="Earned" value={inr(totals.earnings)} />
        <Stat
          label="Outstanding"
          value={inr(Math.max(0, totals.outstanding))}
          tone={totals.outstanding > 0 ? "warn" : "ok"}
        />
      </div>

      {/* Per-link cards */}
      {links.map((l) => {
        const url = `${baseUrl}/p/${l.page_slug}?ref=${l.referral_code}`;
        const commission =
          l.commission_type === "percentage"
            ? `${l.commission_value}% of every sale`
            : `₹${Number(l.commission_value).toLocaleString("en-IN")} per sale`;
        return (
          <Card key={l.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{l.page_title}</CardTitle>
                <Badge variant={l.page_status === "published" ? "default" : "outline"}>
                  {l.page_status}
                </Badge>
              </div>
              <CardDescription>{commission}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Referral link</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate text-xs">{url}</code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copy(url, "Referral link")}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link
                      href={`/p/${l.page_slug}?ref=${l.referral_code}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Clicks" value={String(l.clicks)} />
                <Stat label="Conversions" value={String(l.conversions)} />
                <Stat label="Earned" value={inr(l.earnings)} />
                <Stat
                  label="Outstanding"
                  value={inr(Math.max(0, l.earnings - l.paid_amount))}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Payout history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payouts</CardTitle>
          <CardDescription>
            Pending = commission owed for sales that have closed. Paid = the
            seller has marked it settled with a payment reference.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No payouts yet — share your link.
                  </TableCell>
                </TableRow>
              )}
              {payouts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(p.created_at).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {inr(p.commission_amount)}
                  </TableCell>
                  <TableCell>
                    {p.status === "paid" ? (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Paid
                      </Badge>
                    ) : p.status === "cancelled" ? (
                      <Badge variant="outline">Cancelled</Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-200 text-amber-700">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.payment_reference ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bank details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Bank details
            {firstWithBank?.bank_account_number && (
              <Badge
                variant="outline"
                className="ml-2 align-middle border-emerald-200 text-emerald-700"
              >
                On file
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Sellers need an account number + IFSC to send your payout. Same
            details cover every page you promote on InvoxAI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Account holder name</Label>
            <Input
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              placeholder="As printed on your passbook"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Account number</Label>
              <Input
                value={accountNumber}
                onChange={(e) =>
                  setAccountNumber(e.target.value.replace(/\D/g, ""))
                }
                inputMode="numeric"
                maxLength={18}
              />
            </div>
            <div>
              <Label className="text-xs">IFSC</Label>
              <Input
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                maxLength={11}
                placeholder="HDFC0000XXX"
              />
            </div>
          </div>
          <Button onClick={saveBank} disabled={savingBank}>
            {savingBank && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Wallet className="mr-2 h-4 w-4" />
            Save bank details
          </Button>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Want to refer more pages?{" "}
        <Link href="/" className="text-foreground underline">
          Browse the marketplace
          <ArrowUpRight className="ml-1 inline h-3 w-3" />
        </Link>
      </p>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "ok";
}) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={
          "mt-0.5 text-sm font-semibold " +
          (tone === "warn"
            ? "text-amber-700"
            : tone === "ok"
              ? "text-emerald-600"
              : "")
        }
      >
        {value}
      </p>
    </div>
  );
}
