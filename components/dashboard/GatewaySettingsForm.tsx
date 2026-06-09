"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Trash2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  saveGatewayConfigAction,
  verifyGatewayAction,
  setActiveGatewayAction,
  removeGatewayAction,
} from "@/actions/gateway";

const GATEWAYS = [
  { value: "razorpay", label: "Razorpay" },
  { value: "cashfree", label: "Cashfree" },
  { value: "payu", label: "PayU" },
  { value: "instamojo", label: "Instamojo" },
  { value: "stripe", label: "Stripe" },
] as const;

const LABEL: Record<string, string> = Object.fromEntries(
  GATEWAYS.map((g) => [g.value, g.label]),
);

// Per-provider credential labels (each gateway names its keys differently).
const FIELDS: Record<string, { id: string; secret: string; idPh: string }> = {
  razorpay: { id: "Key ID", secret: "Key Secret", idPh: "rzp_live_xxxxxxxx" },
  cashfree: { id: "App ID (x-client-id)", secret: "Secret Key (x-client-secret)", idPh: "CF…" },
  payu: { id: "Merchant Key", secret: "Salt", idPh: "merchant key" },
  instamojo: { id: "API Key", secret: "Auth Token", idPh: "api key" },
  stripe: { id: "Publishable key", secret: "Secret key (sk_…)", idPh: "pk_live_…" },
};

export interface ExistingGateway {
  gateway_type: string;
  is_active: boolean;
  is_verified: boolean;
}

export function GatewaySettingsForm({
  gateways = [],
  liveGateways = ["razorpay"],
}: {
  gateways?: ExistingGateway[];
  liveGateways?: string[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [gatewayType, setGatewayType] = useState(
    liveGateways[0] ?? "razorpay",
  );
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [isSandbox, setIsSandbox] = useState(false);
  const [testing, setTesting] = useState(false);
  const f = FIELDS[gatewayType] ?? FIELDS.razorpay!;

  const hasActive = gateways.some((g) => g.is_active);

  function clearKeys() {
    setKeyId("");
    setKeySecret("");
    setWebhookSecret("");
  }

  function test() {
    if (!keyId.trim() || !keySecret.trim()) {
      toast({ variant: "destructive", title: "Missing keys", description: "Enter both keys to test." });
      return;
    }
    setTesting(true);
    void verifyGatewayAction({
      gateway_type: gatewayType,
      is_sandbox: gatewayType === "cashfree" ? isSandbox : undefined,
      key_id: keyId,
      key_secret: keySecret,
      webhook_secret: webhookSecret || undefined,
    }).then((res) => {
      setTesting(false);
      toast(
        res.ok
          ? { title: "Connection OK ✅", description: res.message }
          : { variant: "destructive", title: "Test failed", description: res.message },
      );
      if (res.ok) {
        clearKeys();
        router.refresh();
      }
    });
  }

  function save() {
    if (!keyId.trim() || !keySecret.trim()) {
      toast({ variant: "destructive", title: "Missing keys", description: "Enter both the Key ID and Key Secret." });
      return;
    }
    startTransition(async () => {
      const res = await saveGatewayConfigAction({
        gateway_type: gatewayType,
        is_sandbox: gatewayType === "cashfree" ? isSandbox : undefined,
        key_id: keyId,
        key_secret: keySecret,
        webhook_secret: webhookSecret || undefined,
      });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't save", description: res.message });
        return;
      }
      clearKeys();
      toast({ title: "Gateway saved 🎉", description: res.message ?? "Keys saved and encrypted." });
      router.refresh();
    });
  }

  function setPrimary(type: string) {
    startTransition(async () => {
      const res = await setActiveGatewayAction({ gateway_type: type });
      toast(
        res.ok
          ? { title: "Primary gateway switched", description: res.message }
          : { variant: "destructive", title: "Couldn't switch", description: res.message },
      );
      if (res.ok) router.refresh();
    });
  }

  function remove(type: string) {
    if (!confirm(`Remove your ${LABEL[type] ?? type} keys?`)) return;
    startTransition(async () => {
      const res = await removeGatewayAction({ gateway_type: type });
      toast(
        res.ok
          ? { title: "Gateway removed", description: res.message }
          : { variant: "destructive", title: "Couldn't remove", description: res.message },
      );
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Connected gateways list + switch ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your payment gateways</CardTitle>
          <CardDescription>
            Connect as many as you like — your keys for each are saved. One is
            your <strong>Primary</strong> account; that&apos;s the one buyers pay
            through. Switch instantly with “Set as primary”.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {gateways.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No gateways connected yet. Add one below.
            </p>
          )}
          {!hasActive && gateways.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/10 dark:text-amber-200">
              ⚠️ No primary gateway — your store can&apos;t take payments. Click
              <strong> Set as primary</strong> on one below.
            </div>
          )}
          {gateways.map((g) => (
            <div
              key={g.gateway_type}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {LABEL[g.gateway_type] ?? g.gateway_type}
                </span>
                {g.is_active ? (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Primary
                  </Badge>
                ) : (
                  <Badge variant="outline">Backup</Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {g.is_verified ? "verified" : "unverified"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {!g.is_active && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPrimary(g.gateway_type)}
                    disabled={pending || testing}
                  >
                    Set as primary
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(g.gateway_type)}
                  disabled={pending || testing}
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Add / update a gateway ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connect / update a gateway</CardTitle>
          <CardDescription>
            Buyer payments go directly to your own gateway account. Keys are
            encrypted at rest and never shown back.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Gateway</Label>
            <select
              value={gatewayType}
              onChange={(e) => setGatewayType(e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {GATEWAYS.map((g) => {
                const enabled = liveGateways.includes(g.value);
                return (
                  <option key={g.value} value={g.value} disabled={!enabled}>
                    {g.label}
                    {enabled ? "" : " (coming soon)"}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <Label className="text-xs">{f.id}</Label>
            <Input
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              placeholder={f.idPh}
              className="mt-1"
              autoComplete="off"
            />
          </div>

          <div>
            <Label className="text-xs">{f.secret}</Label>
            <Input
              type="password"
              value={keySecret}
              onChange={(e) => setKeySecret(e.target.value)}
              placeholder="••••••••••••••••"
              className="mt-1"
              autoComplete="off"
            />
          </div>

          <div>
            <Label className="text-xs">Webhook Secret (optional)</Label>
            <Input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="••••••••••••••••"
              className="mt-1"
              autoComplete="off"
            />
          </div>

          {gatewayType === "cashfree" && (
            <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
              <input
                type="checkbox"
                checked={isSandbox}
                onChange={(e) => setIsSandbox(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Sandbox (test) mode</span> — turn ON
                if these are Cashfree TEST keys. Live keys: leave OFF. Sandbox keys against the
                live API (or vice-versa) return a 401 at checkout.
              </span>
            </label>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} disabled={pending || testing}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save keys
            </Button>
            <Button variant="outline" onClick={test} disabled={pending || testing}>
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test &amp; verify
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            “Test &amp; verify” checks the keys live and saves them.
            {hasActive
              ? " It won’t change your primary gateway — use “Set as primary” above to switch."
              : " The first gateway you connect becomes your primary automatically."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
