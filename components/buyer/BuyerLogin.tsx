"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, ShoppingBag } from "lucide-react";

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

const LOGIN_ERRORS: Record<string, string> = {
  google_failed: "Google sign-in didn't complete. Try again or use a code.",
  google_unavailable: "Google sign-in isn't available right now.",
  expired: "That sign-in link expired. Please try again.",
};

export function BuyerLogin({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"email" | "otp" | "sending" | "verifying">(
    "email",
  );

  // Surface an OAuth error handed back via ?login=… then clean the URL.
  useEffect(() => {
    const code = searchParams.get("login");
    if (code && LOGIN_ERRORS[code]) {
      toast({
        variant: "destructive",
        title: "Couldn't sign in",
        description: LOGIN_ERRORS[code],
      });
      router.replace("/account");
    }
  }, [searchParams, toast, router]);

  async function requestOtp() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        variant: "destructive",
        title: "Enter a valid email",
        description: "Use the email you bought with.",
      });
      return;
    }
    setStage("sending");
    try {
      const res = await fetch("/api/buyer/request-otp", {
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
        description: "If that email has purchases, a code is on the way.",
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
      const res = await fetch("/api/buyer/verify-otp", {
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
      <div className="mb-6 flex items-center gap-2 text-muted-foreground">
        <ShoppingBag className="h-5 w-5" />
        <span className="font-sora text-lg font-semibold text-foreground">
          Your purchases
        </span>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>
            Enter the email you bought with — we&apos;ll send a one-time code. No
            password needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleEnabled && (
            <>
              <a href="/api/buyer/google/start" className="block">
                <Button variant="outline" className="w-full" type="button">
                  <GoogleGlyph className="mr-2 h-4 w-4" />
                  Continue with Google
                </Button>
              </a>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or use your email
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
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
            <Button
              onClick={requestOtp}
              disabled={stage === "sending"}
              className="w-full"
            >
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
                Verify &amp; view purchases
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.74z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3a7.2 7.2 0 0 1-10.79-3.77H1.27v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.32a7.2 7.2 0 0 1 0-4.63V6.6H1.27a12 12 0 0 0 0 10.8l4.01-3.08z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.43-3.43A11.96 11.96 0 0 0 12 0 12 12 0 0 0 1.27 6.6l4.01 3.09A7.2 7.2 0 0 1 12 4.77z"
      />
    </svg>
  );
}
