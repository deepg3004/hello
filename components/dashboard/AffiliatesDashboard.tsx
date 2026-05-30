"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  PauseCircle,
  PlayCircle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

import {
  payAffiliateAllOutstandingAction,
  upsertAffiliateProgramAction,
} from "@/actions/affiliates";

interface PageRow {
  id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
}

interface ProgramRow {
  id: string;
  page_id: string;
  commission_type: "percentage" | "fixed";
  commission_value: number;
  status: "active" | "paused";
  terms: string | null;
}

interface LinkRow {
  id: string;
  affiliate_id: string;
  referrer_name: string;
  referrer_email: string;
  referrer_phone: string | null;
  referral_code: string;
  clicks: number;
  conversions: number;
  earnings: number;
  paid_amount: number;
  status: "active" | "paused";
  created_at: string;
  has_bank: boolean;
}

interface Props {
  pages: PageRow[];
  programs: ProgramRow[];
  links: LinkRow[];
  baseUrl: string;
}

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function AffiliatesDashboard({
  pages,
  programs,
  links,
  baseUrl,
}: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const programByPage = useMemo(() => {
    const m = new Map<string, ProgramRow>();
    for (const p of programs) m.set(p.page_id, p);
    return m;
  }, [programs]);

  const [selectedPageId, setSelectedPageId] = useState<string>(
    pages[0]?.id ?? "",
  );
  const program = selectedPageId
    ? programByPage.get(selectedPageId) ?? null
    : null;

  // Form state seeded from the current program (or sensible defaults).
  const [commissionType, setCommissionType] = useState<"percentage" | "fixed">(
    program?.commission_type ?? "percentage",
  );
  const [commissionValue, setCommissionValue] = useState<string>(
    program ? String(program.commission_value) : "10",
  );
  const [terms, setTerms] = useState(program?.terms ?? "");

  // Reset form whenever the selected page changes.
  function selectPage(id: string) {
    setSelectedPageId(id);
    const next = programByPage.get(id);
    setCommissionType(next?.commission_type ?? "percentage");
    setCommissionValue(next ? String(next.commission_value) : "10");
    setTerms(next?.terms ?? "");
  }

  function save(newStatus: "active" | "paused" = "active") {
    if (!selectedPageId) return;
    const val = Number(commissionValue);
    if (!Number.isFinite(val) || val < 0) {
      toast({
        variant: "destructive",
        title: "Invalid commission",
        description: "Enter a non-negative number.",
      });
      return;
    }
    startTransition(async () => {
      const res = await upsertAffiliateProgramAction({
        page_id: selectedPageId,
        commission_type: commissionType,
        commission_value: val,
        terms: terms.trim() || undefined,
        status: newStatus,
      });
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't save",
          description: res.message,
        });
        return;
      }
      toast({
        title:
          newStatus === "paused"
            ? "Program paused"
            : program
              ? "Program updated"
              : "Program enabled 🚀",
      });
    });
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied` });
    } catch {
      toast({
        variant: "destructive",
        title: "Couldn't copy",
        description: "Long-press to copy manually.",
      });
    }
  }

  function downloadCsv() {
    if (!links.length) {
      toast({ title: "Nothing to export yet" });
      return;
    }
    const rows = [
      [
        "Name",
        "Email",
        "Phone",
        "Referral code",
        "Clicks",
        "Conversions",
        "Conv %",
        "Earnings",
        "Paid",
        "Outstanding",
        "Bank on file",
        "Status",
        "Joined",
      ],
      ...links.map((l) => [
        l.referrer_name,
        l.referrer_email,
        l.referrer_phone ?? "",
        l.referral_code,
        String(l.clicks),
        String(l.conversions),
        l.clicks > 0 ? `${((l.conversions / l.clicks) * 100).toFixed(2)}%` : "—",
        String(l.earnings),
        String(l.paid_amount),
        String(Math.max(0, l.earnings - l.paid_amount)),
        l.has_bank ? "yes" : "no",
        l.status,
        new Date(l.created_at).toISOString(),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `affiliates-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Memoised totals — declared above the early-return so hook order stays
  // stable in every render.
  const linksForPage = useMemo(
    () => (program ? links.filter((l) => l.affiliate_id === program.id) : []),
    [program, links],
  );
  const totals = useMemo(() => {
    const earnings = linksForPage.reduce((s, l) => s + l.earnings, 0);
    const paid = linksForPage.reduce((s, l) => s + l.paid_amount, 0);
    const clicks = linksForPage.reduce((s, l) => s + l.clicks, 0);
    const conversions = linksForPage.reduce((s, l) => s + l.conversions, 0);
    return { earnings, paid, outstanding: earnings - paid, clicks, conversions };
  }, [linksForPage]);

  // ── render ────────────────────────────────────────────────────────────
  if (pages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">No pages yet</CardTitle>
          <CardDescription>
            Create a published page first — affiliates promote pages, so they
            need somewhere to point at.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const joinUrl = selectedPageId
    ? `${baseUrl}/affiliate/join/${selectedPageId}`
    : "";

  return (
    <div className="space-y-6">
      {/* Page selector + program form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Program setup</CardTitle>
          <CardDescription>
            Pick a page, set the cut, share the join link. Affiliates earn the
            same on every order they refer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs">Page</Label>
              <Select value={selectedPageId} onValueChange={selectPage}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a page" />
                </SelectTrigger>
                <SelectContent>
                  {pages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} · /p/{p.slug}
                      {programByPage.get(p.id) ? " · 🟢" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-[1fr_140px] gap-2">
              <div>
                <Label className="text-xs">Commission</Label>
                <Input
                  inputMode="decimal"
                  value={commissionValue}
                  onChange={(e) => setCommissionValue(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select
                  value={commissionType}
                  onValueChange={(v) =>
                    setCommissionType(v as "percentage" | "fixed")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">% of sale</SelectItem>
                    <SelectItem value="fixed">₹ per sale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Terms (optional)</Label>
            <Textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="e.g. Self-referrals don't count. Refunds claw back commission."
              rows={3}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => save("active")} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {program ? "Save changes" : "Enable program"}
            </Button>
            {program && program.status === "active" && (
              <Button
                variant="outline"
                onClick={() => save("paused")}
                disabled={pending}
              >
                <PauseCircle className="mr-2 h-4 w-4" />
                Pause
              </Button>
            )}
            {program && program.status === "paused" && (
              <Button
                variant="outline"
                onClick={() => save("active")}
                disabled={pending}
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                Resume
              </Button>
            )}
            {program && (
              <Badge
                variant={program.status === "active" ? "default" : "outline"}
                className="ml-auto"
              >
                {program.status}
              </Badge>
            )}
          </div>

          {program && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Affiliate join link
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs">
                  {joinUrl}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copy(joinUrl, "Join link")}
                >
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Affiliate roll-up */}
      {program && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Affiliates</CardTitle>
                <CardDescription>
                  Earnings = pending + paid. Outstanding = what you still owe.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadCsv}
              >
                <Download className="mr-2 h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Clicks" value={totals.clicks.toLocaleString("en-IN")} />
              <Stat
                label="Conversions"
                value={totals.conversions.toLocaleString("en-IN")}
              />
              <Stat label="Earnings" value={inr(totals.earnings)} />
              <Stat
                label="Outstanding"
                value={inr(totals.outstanding)}
                tone={totals.outstanding > 0 ? "warn" : "ok"}
              />
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Referral link</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Conv.</TableHead>
                  <TableHead className="text-right">Earnings</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linksForPage.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No affiliates yet. Share the join link above.
                    </TableCell>
                  </TableRow>
                )}
                {linksForPage.map((l) => {
                  const outstanding = Math.max(0, l.earnings - l.paid_amount);
                  const conv =
                    l.clicks > 0
                      ? `${((l.conversions / l.clicks) * 100).toFixed(1)}%`
                      : "—";
                  const refUrl = `${baseUrl}/p/${slugForProgram(program, pages)}?ref=${l.referral_code}`;
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.referrer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.referrer_email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-muted px-2 py-1 text-[11px]">
                            {l.referral_code}
                          </code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => copy(refUrl, "Referral link")}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {l.clicks}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {l.conversions} · {conv}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {inr(l.earnings)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {outstanding > 0 ? (
                          <span className="text-amber-700">{inr(outstanding)}</span>
                        ) : (
                          <span className="text-emerald-600">
                            <CheckCircle2 className="inline h-3.5 w-3.5" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <PayButton
                          linkId={l.id}
                          outstanding={outstanding}
                          hasBank={l.has_bank}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function slugForProgram(p: ProgramRow, pages: PageRow[]): string {
  return pages.find((x) => x.id === p.page_id)?.slug ?? "";
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

function PayButton({
  linkId,
  outstanding,
  hasBank,
}: {
  linkId: string;
  outstanding: number;
  hasBank: boolean;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function pay() {
    if (outstanding <= 0) return;
    const ref = prompt(
      `Mark ₹${outstanding.toLocaleString(
        "en-IN",
      )} as paid. Enter the bank UTR or "manual":`,
    );
    if (!ref) return;
    startTransition(async () => {
      const res = await payAffiliateAllOutstandingAction({
        affiliate_link_id: linkId,
        payment_reference: ref,
      });
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't mark paid",
          description: res.message,
        });
        return;
      }
      toast({
        title: "Marked paid",
        description: "The affiliate will see it in their portal.",
      });
    });
  }

  if (outstanding <= 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={pay}
      disabled={pending}
      title={hasBank ? "Bank on file" : "No bank info yet — pay outside"}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Wallet className="mr-2 h-3.5 w-3.5" />
      )}
      Pay
    </Button>
  );
}
