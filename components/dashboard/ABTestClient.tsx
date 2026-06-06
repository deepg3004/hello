"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  PlayCircle,
  StopCircle,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePublicPageUrl } from "@/components/dashboard/SellerContext";

import {
  promoteWinnerAction,
  startExperimentAction,
  stopExperimentAction,
} from "@/actions/ab";

type SuccessMetric = "payment_conversion" | "form_submission";
type Variant = "A" | "B";

interface VariantSnapshot {
  variant: Variant;
  visitors: number;
  conversions: number;
  conversion_rate: number;
  revenue: number;
}

interface StatsResponse {
  ok: boolean;
  experiment_status: string;
  traffic_split: number | null;
  success_metric: string | null;
  started_at: string | null;
  snapshots: VariantSnapshot[];
  z: number;
  confidence: number;
  winner: Variant | null;
  significant: boolean;
  thresholds: { min_per_arm: number; confidence: number };
}

interface Props {
  pageId: string;
  slug: string;
  templateId: string;
  pageConfig: Record<string, unknown>;
  variantBConfig: Record<string, unknown> | null;
  experimentStatus: string;
  trafficSplit: number;
  successMetric: SuccessMetric;
  pageType: "payment" | "landing" | "lead_magnet";
  startedAt: string | null;
}

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

export function ABTestClient(props: Props) {
  const { toast } = useToast();
  const buildPageUrl = usePublicPageUrl();
  const liveUrl = buildPageUrl(props.pageType, props.slug, props.templateId);
  const [pending, startTransition] = useTransition();

  const isRunning = props.experimentStatus === "running";

  // ── Setup form (idle / completed state) ───────────────────────────────
  const [trafficSplit, setTrafficSplit] = useState<number>(
    props.trafficSplit ?? 50,
  );
  const [successMetric, setSuccessMetric] = useState<SuccessMetric>(
    props.successMetric ?? "payment_conversion",
  );
  const [variantBJson, setVariantBJson] = useState<string>(() =>
    JSON.stringify(props.variantBConfig ?? props.pageConfig, null, 2),
  );

  function copyAtoB() {
    setVariantBJson(JSON.stringify(props.pageConfig, null, 2));
    toast({
      title: "Duplicated to B",
      description: "Tweak Variant B's JSON, then start the experiment.",
    });
  }

  function start() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(variantBJson) as Record<string, unknown>;
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Invalid JSON",
        description: e instanceof Error ? e.message : String(e),
      });
      return;
    }
    startTransition(async () => {
      const res = await startExperimentAction({
        page_id: props.pageId,
        variant_b_config: parsed,
        traffic_split: trafficSplit,
        success_metric: successMetric,
      });
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't start",
          description: res.message,
        });
        return;
      }
      toast({
        title: "Experiment started 🚀",
        description: `Sending ${trafficSplit}% of traffic to A, ${100 - trafficSplit}% to B.`,
      });
    });
  }

  // ── Live stats (running state) ────────────────────────────────────────
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    let cancelled = false;
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const res = await fetch(`/api/pages/${props.pageId}/ab-stats`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as StatsResponse;
        if (!cancelled) setStats(body);
      } catch {
        /* network noise */
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    };
    void fetchStats();
    const id = setInterval(fetchStats, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isRunning, props.pageId, refreshTick]);

  function stop() {
    if (!confirm("Stop the experiment? Variant A stays as the live page.")) return;
    startTransition(async () => {
      const res = await stopExperimentAction(props.pageId);
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't stop",
          description: res.message,
        });
        return;
      }
      toast({ title: "Experiment stopped" });
    });
  }

  function promote(winner: Variant) {
    const label = winner === "A" ? "A (current)" : "B (challenger)";
    if (
      !confirm(
        `Promote Variant ${label} as the new live page? This overwrites the current page config when B wins.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await promoteWinnerAction({
        page_id: props.pageId,
        winner,
      });
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't promote",
          description: res.message,
        });
        return;
      }
      toast({ title: `Variant ${winner} promoted 🏆` });
    });
  }

  const snapshotA = useMemo(
    () => stats?.snapshots.find((s) => s.variant === "A"),
    [stats],
  );
  const snapshotB = useMemo(
    () => stats?.snapshots.find((s) => s.variant === "B"),
    [stats],
  );

  // ── render ────────────────────────────────────────────────────────────

  if (!isRunning) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Set up a new experiment</CardTitle>
          <CardDescription>
            Duplicate the live page to Variant B, tweak its config, pick a
            traffic split, and let visitors decide.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Variant A · live page</CardTitle>
                <CardDescription>
                  Current {liveUrl}.
                  Read-only here — edit on the page editor.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Open live page <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  Variant B · challenger
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={copyAtoB}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Duplicate A
                  </Button>
                </CardTitle>
                <CardDescription>
                  Edit the page_config JSON (same shape as Variant A).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={variantBJson}
                  onChange={(e) => setVariantBJson(e.target.value)}
                  rows={16}
                  className="font-mono text-xs"
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label className="mb-2 block text-sm">
                Traffic split — Variant A: {trafficSplit}% · Variant B:{" "}
                {100 - trafficSplit}%
              </Label>
              <input
                type="range"
                min={10}
                max={90}
                step={5}
                value={trafficSplit}
                onChange={(e) => setTrafficSplit(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                We&apos;ll only allow 10–90 to keep both arms statistically
                meaningful.
              </p>
            </div>
            <div>
              <Label className="mb-2 block text-sm">Success metric</Label>
              <Select
                value={successMetric}
                onValueChange={(v) => setSuccessMetric(v as SuccessMetric)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment_conversion">
                    Payment conversion
                  </SelectItem>
                  <SelectItem value="form_submission">
                    Form submission
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {props.pageType === "landing"
                  ? "Landing pages count as conversion = form submitted."
                  : "Payment pages count as conversion = order paid."}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={start} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <PlayCircle className="mr-2 h-4 w-4" />
              Start experiment
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Running state
  const confidence = stats?.confidence ?? 0;
  const winner = stats?.winner ?? null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-4 text-sm">
        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
          Running
        </Badge>
        <span className="text-muted-foreground">
          Started {props.startedAt ? new Date(props.startedAt).toLocaleString("en-IN") : "—"} · Split{" "}
          {stats?.traffic_split ?? props.trafficSplit}% / {100 - (stats?.traffic_split ?? props.trafficSplit)}%
        </span>
        <span className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
          {loadingStats && <Loader2 className="h-3 w-3 animate-spin" />}
          Confidence so far: <strong>{(confidence * 100).toFixed(1)}%</strong>
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRefreshTick((t) => t + 1)}
        >
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <VariantCard
          label="Variant A · current"
          accent="border-border"
          snapshot={snapshotA}
          isWinner={winner === "A"}
          onPromote={() => promote("A")}
          promoting={pending}
        />
        <VariantCard
          label="Variant B · challenger"
          accent="border-blue-200"
          snapshot={snapshotB}
          isWinner={winner === "B"}
          onPromote={() => promote("B")}
          promoting={pending}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Statistical confidence</CardTitle>
          <CardDescription>
            Two-proportion z-test. We declare a winner once confidence ≥ 95%
            AND both variants have ≥ {stats?.thresholds.min_per_arm ?? 100}{" "}
            visitors.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={confidence * 100} />
          <p className="text-sm text-muted-foreground">
            {winner ? (
              <span className="text-emerald-600">
                <Trophy className="mr-1 inline h-4 w-4" />
                Variant <strong>{winner}</strong> is winning with {(confidence * 100).toFixed(1)}%
                confidence.
              </span>
            ) : (
              <>
                {confidence >= 0.95 ? (
                  <>
                    Confidence is there ({(confidence * 100).toFixed(1)}%) but
                    we need at least {stats?.thresholds.min_per_arm ?? 100}{" "}
                    visitors per arm before promoting.
                  </>
                ) : (
                  <>
                    Not significant yet ({(confidence * 100).toFixed(1)}%
                    confidence). Keep gathering data.
                  </>
                )}
              </>
            )}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={stop} disabled={pending}>
          <StopCircle className="mr-2 h-4 w-4" />
          Stop experiment
        </Button>
        {winner && (
          <Button onClick={() => promote(winner)} disabled={pending}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Promote Variant {winner}
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1">
          <ArrowUpRight className="h-3 w-3" />
          Counters auto-refresh every 30 s
        </span>
      </div>
    </div>
  );
}

function VariantCard({
  label,
  accent,
  snapshot,
  isWinner,
  onPromote,
  promoting,
}: {
  label: string;
  accent: string;
  snapshot: VariantSnapshot | undefined;
  isWinner: boolean;
  onPromote: () => void;
  promoting: boolean;
}) {
  return (
    <Card className={`${accent} ${isWinner ? "ring-2 ring-emerald-400" : ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          {label}
          {isWinner && (
            <Badge className="bg-emerald-100 text-emerald-700">
              <Trophy className="mr-1 h-3 w-3" />
              Winner
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Row label="Visitors" value={String(snapshot?.visitors ?? 0)} />
        <Row label="Conversions" value={String(snapshot?.conversions ?? 0)} />
        <Row
          label="Conversion rate"
          value={pct(snapshot?.conversion_rate ?? 0)}
        />
        <Row label="Revenue" value={inr(snapshot?.revenue ?? 0)} />
        {isWinner && (
          <Button
            size="sm"
            variant="outline"
            onClick={onPromote}
            disabled={promoting}
            className="w-full"
          >
            <Trophy className="mr-2 h-4 w-4" />
            Promote this variant
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}
