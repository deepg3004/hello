"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Loader2, ShieldCheck, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Factor {
  id: string;
  friendly_name: string | null;
  status: string;
}

/**
 * TOTP two-factor management. Enroll → scan QR → verify a 6-digit code →
 * factor becomes active. Existing verified factor shows a remove control.
 * Uses the browser Supabase client (MFA APIs are client-side).
 */
export function TwoFactorSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [busy, setBusy] = useState(false);

  // In-progress enrollment
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function refresh() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    setLoading(false);
    if (error) return;
    setFactors((data?.all ?? []) as Factor[]);
  }

  useEffect(() => {
    refresh();
  }, []);

  const verified = factors.find((f) => f.status === "verified");

  async function startEnroll() {
    setBusy(true);
    const supabase = createClient();
    // Clear any stale unverified factor first so re-enrolling doesn't collide.
    const stale = factors.find((f) => f.status !== "verified");
    if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id });

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      // `issuer` is what authenticator apps show as the account name — without
      // it Supabase defaults to the request host (e.g. "localhost").
      issuer: "InvoxAI",
      friendlyName: `InvoxAI · ${new Date().toISOString().slice(0, 10)}`,
    });
    setBusy(false);
    if (error || !data) {
      toast({ title: "Couldn't start 2FA setup", description: error?.message, variant: "destructive" });
      return;
    }
    setFactorId(data.id);
    setSecret(data.totp.secret);
    // Build our own otpauth URI so the authenticator shows ONLY the brand name
    // (Supabase's default QR labels the account with the user's email). The
    // TOTP secret is identical, so verification is unaffected, and we render
    // the QR locally — the secret never leaves the browser.
    const issuer = "InvoxAI";
    const uri =
      `otpauth://totp/${encodeURIComponent(issuer)}?secret=${data.totp.secret}` +
      `&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    try {
      const dataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 200 });
      setQr(dataUrl);
    } catch {
      setQr(data.totp.qr_code); // fall back to Supabase's QR if local render fails
    }
    setEnrolling(true);
  }

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
    toast({ title: "Two-factor enabled", description: "You'll be asked for a code at login." });
    setEnrolling(false);
    setQr(null);
    setSecret(null);
    setCode("");
    setFactorId(null);
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Turn off two-factor authentication for your account?")) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't disable 2FA", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Two-factor disabled" });
    refresh();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  // Already protected.
  if (verified && !enrolling) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Two-factor authentication is on.
        </span>
        <Button variant="outline" size="sm" onClick={() => remove(verified.id)} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
          Disable
        </Button>
      </div>
    );
  }

  // Enrollment in progress — show QR + verify.
  if (enrolling && qr) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Scan this QR code with Google Authenticator, Authy, or 1Password, then
          enter the 6-digit code to confirm.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="2FA QR code" className="h-44 w-44 rounded-lg border border-border bg-card p-2" />
        {secret && (
          <p className="text-xs text-muted-foreground">
            Or enter this key manually: <code className="font-mono text-foreground">{secret}</code>
          </p>
        )}
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">6-digit code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="w-32 font-mono tracking-widest"
              inputMode="numeric"
            />
          </div>
          <Button onClick={verify} disabled={busy || code.length !== 6}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            Verify &amp; enable
          </Button>
          <Button variant="ghost" onClick={() => { setEnrolling(false); setQr(null); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Not set up yet.
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Add a second step at login using an authenticator app — protects your
        account even if your password leaks.
      </p>
      <Button onClick={startEnroll} disabled={busy}>
        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
        Enable two-factor authentication
      </Button>
    </div>
  );
}
