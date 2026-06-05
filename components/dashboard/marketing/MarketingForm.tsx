"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { saveMarketingIntegrationsAction, testPixelAction } from "@/actions/marketing";

export interface MarketingState {
  meta_pixel_id: string | null;
  ga4_id: string | null;
  google_ads_id: string | null;
  tiktok_pixel_id: string | null;
  custom_head_html: string | null;
  webhook_url: string | null;
  webhook_events: string[];
  active: boolean;
}

const EVENTS: { key: string; label: string }[] = [
  { key: "order_paid", label: "Order paid" },
  { key: "lead_created", label: "New lead" },
  { key: "booking_created", label: "New booking" },
];

export function MarketingForm({ initial }: { initial: MarketingState | null }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const [s, setS] = useState<MarketingState>(
    initial ?? {
      meta_pixel_id: "",
      ga4_id: "",
      google_ads_id: "",
      tiktok_pixel_id: "",
      custom_head_html: "",
      webhook_url: "",
      webhook_events: EVENTS.map((e) => e.key),
      active: true,
    },
  );

  const set = (k: keyof MarketingState, v: unknown) => setS({ ...s, [k]: v });
  const toggleEvent = (key: string) =>
    set(
      "webhook_events",
      s.webhook_events.includes(key)
        ? s.webhook_events.filter((e) => e !== key)
        : [...s.webhook_events, key],
    );

  function save() {
    start(async () => {
      const res = await saveMarketingIntegrationsAction(s);
      toast(
        res.ok
          ? { title: "Marketing settings saved" }
          : { variant: "destructive", title: "Couldn't save", description: res.message },
      );
    });
  }

  function sendTest() {
    startTest(async () => {
      const res = await testPixelAction();
      toast(
        res.ok
          ? { title: "Test sent", description: res.message }
          : { variant: "destructive", title: "Test failed", description: res.message },
      );
    });
  }

  return (
    <div className="space-y-6">
      <div className="card-surface space-y-3 p-5">
        <h3 className="text-sm font-semibold">Tracking pixels (site-wide)</h3>
        <p className="text-xs text-muted-foreground">
          Applied across your storefront + website. (Per-page pixels in the page
          editor still work for granular tracking.)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Meta Pixel ID" value={s.meta_pixel_id} onChange={(v) => set("meta_pixel_id", v)} placeholder="1234567890" />
          <Field label="Google Analytics (GA4) ID" value={s.ga4_id} onChange={(v) => set("ga4_id", v)} placeholder="G-XXXXXXX" />
          <Field label="Google Ads ID" value={s.google_ads_id} onChange={(v) => set("google_ads_id", v)} placeholder="AW-XXXXXXX" />
          <Field label="TikTok Pixel ID" value={s.tiktok_pixel_id} onChange={(v) => set("tiktok_pixel_id", v)} placeholder="CXXXXXXXX" />
        </div>
        <div>
          <Label className="text-xs">Custom &lt;head&gt; HTML (advanced)</Label>
          <Textarea
            rows={3}
            value={s.custom_head_html ?? ""}
            onChange={(e) => set("custom_head_html", e.target.value)}
            placeholder="<!-- extra tags injected into <head> -->"
            className="mt-1 font-mono text-xs"
          />
        </div>
      </div>

      <div className="card-surface space-y-3 p-5">
        <h3 className="text-sm font-semibold">Outbound webhook (Zapier / Make)</h3>
        <p className="text-xs text-muted-foreground">
          We POST a JSON payload to your URL when these events happen.
        </p>
        <Field label="Webhook URL" value={s.webhook_url} onChange={(v) => set("webhook_url", v)} placeholder="https://hooks.zapier.com/…" />
        <Button variant="outline" size="sm" onClick={sendTest} disabled={testing || !s.webhook_url}>
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send test event
        </Button>
        <p className="text-xs text-muted-foreground">Save first, then test — we POST to the saved URL.</p>
        <div className="flex flex-wrap gap-3">
          {EVENTS.map((e) => (
            <label key={e.key} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={s.webhook_events.includes(e.key)}
                onChange={() => toggleEvent(e.key)}
              />
              {e.label}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={s.active} onChange={(e) => set("active", e.target.checked)} />
          Integrations active
        </label>
      </div>

      <Button onClick={save} disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1"
      />
    </div>
  );
}
