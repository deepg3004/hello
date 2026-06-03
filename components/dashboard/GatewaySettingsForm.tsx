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
import { saveGatewayConfigAction } from "@/actions/gateway";

const GATEWAYS = [
  { value: "razorpay", label: "Razorpay" },
  { value: "cashfree", label: "Cashfree" },
  { value: "payu", label: "PayU" },
  { value: "instamojo", label: "Instamojo" },
  { value: "stripe", label: "Stripe" },
] as const;

export interface ExistingGateway {
  gateway_type: string;
  is_active: boolean;
  is_verified: boolean;
}

export function GatewaySettingsForm({
  existing,
}: {
  existing: ExistingGateway | null;
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
        )}

        <div>
          <Label className="text-xs">Gateway</Label>
          <select
            value={gatewayType}
            onChange={(e) => setGatewayType(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {GATEWAYS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label className="text-xs">Key ID</Label>
          <Input
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            placeholder="rzp_live_xxxxxxxx"
            className="mt-1"
            autoComplete="off"
          />
        </div>

        <div>
          <Label className="text-xs">Key Secret</Label>
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

        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {existing ? "Update keys" : "Connect gateway"}
        </Button>
      </CardContent>
    </Card>
  );
}
