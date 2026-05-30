"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

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
import { useToast } from "@/hooks/use-toast";

export function AffiliateLogin() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"email" | "otp" | "sending" | "verifying">(
    "email",
  );

  async function requestOtp() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        variant: "destructive",
        title: "Enter a valid email",
        description: "Use the email you signed up to promote with.",
      });
      return;
    }
    setStage("sending");
    try {
      const res = await fetch("/api/affiliate/portal/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't send code",
          description: body.error,
        });
        setStage("email");
        return;
      }
      toast({
        title: "Check your email",
        description: "If you have affiliate links, a code is on the way.",
      });
      setStage("otp");
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Network error",
        description: e instanceof Error ? e.message : String(e),
      });
      setStage("email");
    }
  }

  async function verifyOtp() {
    if (!/^\d{4,8}$/.test(otp.trim())) {
      toast({
        variant: "destructive",
        title: "Invalid code",
        description: "Enter the digits from your email.",
      });
      return;
    }
    setStage("verifying");
    try {
      const res = await fetch("/api/affiliate/portal/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, otp: otp.trim() }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        toast({
          variant: "destructive",
          title: "Verification failed",
          description: body.error,
        });
        setStage("otp");
        return;
      }
      router.refresh();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Network error",
        description: e instanceof Error ? e.message : String(e),
      });
      setStage("otp");
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <Card>
        <CardHeader>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            invoxai.io / affiliate / portal
          </p>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>
            We&apos;ll email a one-time code — no password to remember.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              disabled={stage === "otp" || stage === "verifying"}
            />
          </div>

          {(stage === "otp" || stage === "verifying") && (
            <div>
              <Label className="text-xs">6-digit code</Label>
              <Input
                inputMode="numeric"
                maxLength={8}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
              />
            </div>
          )}

          {stage === "email" || stage === "sending" ? (
            <Button onClick={requestOtp} disabled={stage === "sending"} className="w-full">
              {stage === "sending" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Send code
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStage("email")}
                disabled={stage === "verifying"}
              >
                Change email
              </Button>
              <Button
                onClick={verifyOtp}
                disabled={stage === "verifying"}
                className="flex-1"
              >
                {stage === "verifying" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Verify &amp; enter portal
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
