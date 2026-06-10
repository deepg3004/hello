"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Activity, BarChart3, CheckCircle2, Facebook, Loader2, XCircle } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { saveTrackingSettingsAction } from "@/actions/tracking";

interface Initial {
  meta_pixel_id: string;
  ga4_id: string;
  enable_meta_pixel: boolean;
  enable_ga4: boolean;
  enable_advanced_matching: boolean;
}

interface Health {
  lastEventAt: string | null;
  lastEventName: string | null;
  eventsToday: number;
}

export function TrackingDashboard({
  initial,
  health,
}: {
  initial: Initial;
  health: Health;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [metaId, setMetaId] = useState(initial.meta_pixel_id);
  const [ga4Id, setGa4Id] = useState(initial.ga4_id);
  const [enableMeta, setEnableMeta] = useState(initial.enable_meta_pixel);
  const [enableGa4, setEnableGa4] = useState(initial.enable_ga4);
  const [advMatch, setAdvMatch] = useState(initial.enable_advanced_matching);

  const metaLive = !!metaId && enableMeta;
  const ga4Live = !!ga4Id && enableGa4;

  function save() {
    startTransition(async () => {
      const r = await saveTrackingSettingsAction({
        meta_pixel_id: metaId,
        ga4_id: ga4Id,
        enable_meta_pixel: enableMeta,
        enable_ga4: enableGa4,
        enable_advanced_matching: advMatch,
      });
      toast({
        title: r.ok ? "Tracking saved" : "Couldn't save",
        description: r.ok
          ? "Your pixels will fire on your public pages."
          : r.message,
        variant: r.ok ? undefined : "destructive",
      });
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Overview / Pixel Health ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatusTile label="Meta Pixel" live={metaLive} />
        <StatusTile label="Google Analytics 4" live={ga4Live} />
        <HealthTile
          label="Last event"
          value={
            health.lastEventAt
              ? `${formatDistanceToNow(new Date(health.lastEventAt))} ago`
              : "None yet"
          }
          sub={health.lastEventName ?? undefined}
          icon={Activity}
        />
        <HealthTile
          label="Events today"
          value={health.eventsToday.toLocaleString("en-IN")}
          icon={BarChart3}
        />
      </div>

      {/* ── Meta Pixel ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Facebook className="h-4 w-4 text-[#1877F2]" />
            Meta Pixel
          </CardTitle>
          <CardDescription>
            Find your Pixel ID in Meta Events Manager → Data Sources → your
            pixel. It&apos;s a number like 1234567890.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="meta" className="text-xs">Meta Pixel ID</Label>
              <Input
                id="meta"
                className="mt-1 font-mono"
                placeholder="1234567890123456"
                inputMode="numeric"
                value={metaId}
                onChange={(e) => setMetaId(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <Toggle label="Enabled" checked={enableMeta} onChange={setEnableMeta} />
          </div>
          <Toggle
            label="Advanced matching"
            hint="Send hashed email/phone on conversions for better match rates."
            checked={advMatch}
            onChange={setAdvMatch}
          />
        </CardContent>
      </Card>

      {/* ── Google Analytics 4 ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google Analytics 4</CardTitle>
          <CardDescription>
            In GA4: Admin → Data Streams → your web stream → Measurement ID.
            Looks like G-XXXXXXXX.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="ga4" className="text-xs">GA4 Measurement ID</Label>
              <Input
                id="ga4"
                className="mt-1 font-mono"
                placeholder="G-XXXXXXXX"
                value={ga4Id}
                onChange={(e) => setGa4Id(e.target.value.toUpperCase())}
              />
            </div>
            <Toggle label="Enabled" checked={enableGa4} onChange={setEnableGa4} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Retargeting audience data is sent to your connected Meta Pixel / GA4
          account. Create the final ad audiences inside Meta Ads Manager or
          Google Ads using these events.
        </p>
        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save tracking
        </Button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function StatusTile({ label, live }: { label: string; live: boolean }) {
  return (
    <div className="card-surface flex items-center gap-3 p-4">
      {live ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      ) : (
        <XCircle className="h-5 w-5 text-muted-foreground/50" />
      )}
      <div className="min-w-0">
        <p className="th-label truncate">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-foreground">
          {live ? "Connected" : "Off"}
        </p>
      </div>
    </div>
  );
}

function HealthTile({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Activity;
}) {
  return (
    <div className="card-surface flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl tile-indigo">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="th-label truncate">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
        {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
