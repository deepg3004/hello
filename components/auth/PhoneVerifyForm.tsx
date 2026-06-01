"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Phone, ShieldCheck } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
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

const RESEND_SECONDS = 60;

export function PhoneVerifyForm({ initialPhone }: { initialPhone: string }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const autoSent = useRef(false);

  // Tick down the resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function sendOtp(toPhone: string) {
    setSending(true);
    try {
      const res = await fetch("/api/auth/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: toPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't send code",
          description: data.error ?? "Try again.",
        });
        return;
      }
      setSentTo(toPhone);
      setCooldown(RESEND_SECONDS);
      if (data.devOtp) {
        toast({ title: "Dev OTP", description: `Code: ${data.devOtp}` });
      } else if (data.smsSkipped) {
        toast({ title: "SMS not configured", description: "Ask an admin to set up Twilio." });
      } else {
        toast({ title: "Code sent", description: `We texted a code to ${toPhone}.` });
      }
    } finally {
      setSending(false);
    }
  }

  // Auto-send once on first load if we already have a number.
  useEffect(() => {
    if (autoSent.current) return;
    autoSent.current = true;
    if (initialPhone) void sendOtp(initialPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify() {
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/phone/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Verification failed",
          description: data.error ?? "Try again.",
        });
        return;
      }
      toast({ title: "Phone verified ✅" });
      window.location.href = "/dashboard/onboarding";
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Card className="glass shadow-card-lg">
      <CardHeader className="items-center text-center">
        <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
          <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.5} />
        </span>
        <CardTitle className="font-sora text-xl">Verify your phone</CardTitle>
        <CardDescription>
          {sentTo
            ? `Enter the 6-digit code we texted to ${sentTo}.`
            : "We'll text you a 6-digit code to confirm your number."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phone (editable in case it was wrong at signup). */}
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <div className="flex gap-2">
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => sendOtp(phone)}
              disabled={sending || cooldown > 0 || phone.trim().length < 8}
              className="shrink-0 gap-1.5"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
              {cooldown > 0 ? `${cooldown}s` : sentTo ? "Resend" : "Send code"}
            </Button>
          </div>
        </div>

        {/* OTP */}
        <div className="space-y-2">
          <Label htmlFor="code">Verification code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
            className="text-center text-lg tracking-[0.4em]"
          />
        </div>

        <Button
          type="button"
          className="w-full"
          onClick={verify}
          disabled={verifying || code.trim().length < 4}
        >
          {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify &amp; continue
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Didn&apos;t get it? Check the number above and tap Resend. Standard SMS
          rates may apply.
        </p>
      </CardContent>
    </Card>
  );
}
