"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safe-redirect";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function MfaPage() {
  return (
    <Suspense fallback={null}>
      <MfaInner />
    </Suspense>
  );
}

function MfaInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Find the user's verified TOTP factor.
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.find((f) => f.status === "verified") ?? data?.totp?.[0];
      if (!totp) {
        // No factor (or not signed in) — nothing to challenge; move along.
        router.replace(safeNext(params.get("next")));
        return;
      }
      setFactorId(totp.id);
    })();
  }, [router, params]);

  async function verify() {
    if (!factorId) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (error) {
      toast({ title: "Incorrect code", description: error.message, variant: "destructive" });
      return;
    }
    router.replace(safeNext(params.get("next")));
    router.refresh();
  }

  return (
    <Card className="glass shadow-card-lg">
      <CardHeader className="items-center text-center">
        <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
          <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.5} />
        </span>
        <CardTitle className="font-sora text-xl">Two-factor verification</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && code.length === 6 && verify()}
          placeholder="123456"
          className="text-center font-mono text-lg tracking-[0.5em]"
          inputMode="numeric"
        />
        <Button className="w-full" onClick={verify} disabled={busy || code.length !== 6 || !factorId}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify
        </Button>
      </CardContent>
    </Card>
  );
}
