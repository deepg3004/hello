"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

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
import { useToast } from "@/hooks/use-toast";
import { saveGatewayConfigAction, verifyGatewayAction } from "@/actions/gateway";

// Which gateways are selectable is decided by the server (liveGateways()), so we
// only enable the ones whose buyer-facing checkout is wired end-to-end. The rest
// render disabled ("coming soon") to stop sellers connecting a gateway that
// would 402 at checkout.
const GATEWAYS = [
  { value: "razorpay", label: "Razorpay" },
  { value: "cashfree", label: "Cashfree" },
  { value: "payu", label: "PayU" },
  { value: "instamojo", label: "Instamojo" },
  { value: "stripe", label: "Stripe" },
] as const;

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
  existing,
  liveGateways = ["razorpay"],
}: {
  existing: ExistingGateway | null;
  liveGateways?: string[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [gatewayType, setGatewayType] = useState(
    existing?.gateway_type ?? "razorpay",
  );
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  // Reflect a just-saved connection immediately, independent of the server
  // re-fetch (router-cache timing can otherwise leave the banner stale).
  const [saved, setSaved] = useState<ExistingGateway | null>(existing);
  const [testing, setTesting] = useState(false);
  const f = FIELDS[gatewayType] ?? FIELDS.razorpay!;

  function test() {
    if (!keyId.trim() || !keySecret.trim()) {
      toast({ variant: "destructive", title: "Missing keys", description: "Enter both keys to test." });
      return;
    }
    setTesting(true);
    void verifyGatewayAction({
      gateway_type: gatewayType,
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
        // A successful test verifies AND activates the gateway server-side —
        // reflect that immediately (router-cache can lag the banner).
        setSaved({ gateway_type: gatewayType, is_active: true, is_verified: true });
        router.refresh();
      }
    });
  }

  function save() {
    if (!keyId.trim() || !keySecret.trim()) {
      toast({
        variant: "destructive",
        title: "Missing keys",
        description: "Enter both the Key ID and Key Secret.",
      });
      return;
    }
    startTransition(async () => {
      const res = await saveGatewayConfigAction({
        gateway_type: gatewayType,
        key_id: keyId,
        key_secret: keySecret,
        webhook_secret: webhookSecret || undefined,
      });
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't save",
          description: res.message,
        });
        return;
      }
      // Clear the secret fields after a successful save — we never show them back.
      setKeySecret("");
      setWebhookSecret("");
      setSaved({ gateway_type: gatewayType, is_active: true, is_verified: false });
      toast({
        title: "Gateway connected 🎉",
        description: "Your keys are saved and encrypted.",
      });
      // Re-render from the server so the "Currently connected" banner reflects
      // the new gateway without a manual reload (revalidatePath alone won't
      // refresh this already-hydrated client view).
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Connect your gateway</CardTitle>
        <CardDescription>
          Buyer payments go directly to your own gateway account. Keys are
          encrypted at rest and never shown back.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(saved ?? existing) && (
          <>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {(saved ?? existing)!.is_verified ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Loader2 className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">
                Currently connected:{" "}
                <span className="font-medium text-foreground">
                  {(saved ?? existing)!.gateway_type}
                </span>
                {(saved ?? existing)!.is_verified
                  ? " (verified)"
                  : " (pending verification)"}
              </span>
            </div>
            {!(saved ?? existing)!.is_active && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/10 dark:text-amber-200">
                ⚠️ This gateway is <strong>inactive</strong>, so your store
                can&apos;t take payments right now. Click{" "}
                <strong>Test connection</strong> below (or re-save your keys) to
                switch it back on.
              </div>
            )}
          </>
        )}

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

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={pending || testing}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existing ? "Update keys" : "Connect gateway"}
          </Button>
          <Button variant="outline" onClick={test} disabled={pending || testing}>
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test connection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
