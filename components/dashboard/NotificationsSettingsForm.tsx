"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";

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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

import {
  removeWhatsAppNumberAction,
  updateNotificationPrefsAction,
} from "@/actions/notifications";
import type {
  NotificationEventKey,
  NotificationEventToggles,
} from "@/lib/notifications-config";

interface EventCatalogEntry {
  key: NotificationEventKey;
  label: string;
  description: string;
}

interface Props {
  initialEnabled: boolean;
  initialEvents: Required<NotificationEventToggles>;
  initialEmailEvents: Required<NotificationEventToggles>;
  verifiedNumber: string | null;
  verifiedAt: string | null;
  pendingNumber: string | null;
  pendingExpiresAt: string | null;
  defaultPhone: string | null;
  eventCatalog: EventCatalogEntry[];
}

type Stage = "idle" | "sending" | "awaiting_otp" | "verifying";

export function NotificationsSettingsForm(props: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [enabled, setEnabled] = useState(props.initialEnabled);
  const [events, setEvents] = useState<Required<NotificationEventToggles>>(
    props.initialEvents,
  );
  const [emailEvents, setEmailEvents] = useState<Required<NotificationEventToggles>>(
    props.initialEmailEvents,
  );

  // ── OTP flow state ─────────────────────────────────────────────────────
  const [stage, setStage] = useState<Stage>(
    props.pendingNumber ? "awaiting_otp" : "idle",
  );
  const [phone, setPhone] = useState(
    props.pendingNumber ?? props.defaultPhone ?? "",
  );
  const [otp, setOtp] = useState("");
  const [verifiedNumber, setVerifiedNumber] = useState<string | null>(
    props.verifiedNumber,
  );
  const [verifiedAt, setVerifiedAt] = useState<string | null>(props.verifiedAt);

  const isVerified = !!verifiedNumber;

  // ── Save preferences ───────────────────────────────────────────────────
  function commitPrefs(next: {
    enabled?: boolean;
    events?: NotificationEventToggles;
    email?: NotificationEventToggles;
  }) {
    startTransition(async () => {
      const res = await updateNotificationPrefsAction(next);
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't save",
          description: res.message,
        });
      }
    });
  }

  function toggleMaster(value: boolean) {
    if (value && !isVerified) {
      toast({
        variant: "destructive",
        title: "Verify your WhatsApp first",
        description: "Add and verify a number before turning alerts on.",
      });
      return;
    }
    setEnabled(value);
    commitPrefs({ enabled: value });
  }

  function toggleEvent(key: NotificationEventKey, value: boolean) {
    const next = { ...events, [key]: value };
    setEvents(next);
    commitPrefs({ events: { [key]: value } });
  }

  function toggleEmailEvent(key: NotificationEventKey, value: boolean) {
    const next = { ...emailEvents, [key]: value };
    setEmailEvents(next);
    commitPrefs({ email: { [key]: value } });
  }

  // ── OTP send / verify ──────────────────────────────────────────────────
  async function sendOtp() {
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length < 10) {
      toast({
        variant: "destructive",
        title: "Number looks too short",
        description: "Include the country code (e.g. 91 for India).",
      });
      return;
    }
    setStage("sending");
    try {
      const res = await fetch("/api/notifications/verify-whatsapp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; dev_otp?: string };
      if (!res.ok || !body.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't send OTP",
          description: body.error,
        });
        setStage("idle");
        return;
      }
      setStage("awaiting_otp");
      toast({
        title: "OTP sent",
        description: body.dev_otp
          ? `Dev OTP: ${body.dev_otp}`
          : "Check your SMS for the 6-digit code.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Network error",
        description: e instanceof Error ? e.message : String(e),
      });
      setStage("idle");
    }
  }

  async function confirmOtp() {
    if (!/^\d{4,8}$/.test(otp.trim())) {
      toast({
        variant: "destructive",
        title: "Invalid OTP",
        description: "Enter the digits from your SMS.",
      });
      return;
    }
    setStage("verifying");
    try {
      const res = await fetch("/api/notifications/confirm-whatsapp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ otp: otp.trim() }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        whatsapp_number?: string;
        verified_at?: string;
      };
      if (!res.ok || !body.ok) {
        toast({
          variant: "destructive",
          title: "Verification failed",
          description: body.error,
        });
        setStage("awaiting_otp");
        return;
      }
      setVerifiedNumber(body.whatsapp_number ?? null);
      setVerifiedAt(body.verified_at ?? null);
      setEnabled(true);
      setOtp("");
      setStage("idle");
      toast({
        title: "WhatsApp verified",
        description: `Alerts will go to ${body.whatsapp_number}.`,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Network error",
        description: e instanceof Error ? e.message : String(e),
      });
      setStage("awaiting_otp");
    }
  }

  async function removeNumber() {
    if (!confirm("Disconnect this WhatsApp number? You can re-verify later.")) return;
    startTransition(async () => {
      const res = await removeWhatsAppNumberAction();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't remove",
          description: res.message,
        });
        return;
      }
      setVerifiedNumber(null);
      setVerifiedAt(null);
      setEnabled(false);
      setStage("idle");
      setPhone("");
      toast({ title: "WhatsApp disconnected" });
    });
  }

  return (
    <div className="space-y-6">
      {/* ─── Master + number ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">WhatsApp delivery</CardTitle>
          <CardDescription>
            We use MSG91&apos;s WhatsApp Business API. The number you verify
            here is the one we&apos;ll text when an event fires.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-md border p-4">
            <div>
              <p className="text-sm font-medium">Enable WhatsApp alerts</p>
              <p className="text-xs text-muted-foreground">
                Turn on once a number is verified.
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={toggleMaster}
              disabled={pending || !isVerified}
            />
          </div>

          {isVerified ? (
            <div className="flex flex-col items-start gap-3 rounded-md border bg-emerald-50/40 p-4 dark:border-emerald-500/30 dark:bg-emerald-900/10 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                <div>
                  <p className="text-sm font-medium">
                    Verified: +{verifiedNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {verifiedAt
                      ? `Confirmed ${new Date(verifiedAt).toLocaleString("en-IN")}`
                      : null}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={removeNumber}
                disabled={pending}
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-3 rounded-md border p-4">
              <Label htmlFor="wa-phone">WhatsApp number</Label>
              <div className="flex gap-2">
                <Input
                  id="wa-phone"
                  placeholder="91XXXXXXXXXX"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={stage === "awaiting_otp"}
                />
                {stage === "awaiting_otp" || stage === "verifying" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStage("idle")}
                    disabled={stage === "verifying"}
                  >
                    Change
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={sendOtp}
                    disabled={stage === "sending"}
                  >
                    {stage === "sending" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Send OTP"
                    )}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Include the country code. We&apos;ll text you a 6-digit code.
              </p>

              {(stage === "awaiting_otp" || stage === "verifying") && (
                <>
                  <Separator />
                  <Label htmlFor="wa-otp">Enter the OTP</Label>
                  <div className="flex gap-2">
                    <Input
                      id="wa-otp"
                      inputMode="numeric"
                      placeholder="123456"
                      maxLength={8}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      disabled={stage === "verifying"}
                    />
                    <Button
                      type="button"
                      onClick={confirmOtp}
                      disabled={stage === "verifying"}
                    >
                      {stage === "verifying" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Verify"
                      )}
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline"
                    onClick={sendOtp}
                    disabled={stage === "verifying"}
                  >
                    Resend OTP
                  </button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Event toggles ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What we&apos;ll alert you about</CardTitle>
          <CardDescription>
            Each event can fire on WhatsApp, email, or both. Email is on by
            default; WhatsApp requires the master switch above.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <div className="grid grid-cols-[1fr_64px_64px] items-center gap-3 pb-3 text-xs uppercase tracking-wide text-muted-foreground">
            <span>Event</span>
            <span className="text-center">WhatsApp</span>
            <span className="text-center">Email</span>
          </div>
          {props.eventCatalog.map((evt) => (
            <div
              key={evt.key}
              className="grid grid-cols-[1fr_64px_64px] items-center gap-3 py-3"
            >
              <div>
                <p className="text-sm font-medium">{evt.label}</p>
                <p className="text-xs text-muted-foreground">{evt.description}</p>
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={!!events[evt.key]}
                  onCheckedChange={(v) => toggleEvent(evt.key, v)}
                  disabled={pending || !isVerified || !enabled}
                />
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={!!emailEvents[evt.key]}
                  onCheckedChange={(v) => toggleEmailEvent(evt.key, v)}
                  disabled={pending}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ─── Quick legend ───────────────────────────────────────────── */}
      <div className="rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
          <span>
            Sample alert preview: <em>&quot;Great news! 🎉 New sale on InvoxAI · Buyer: Riya · Product: Cohort May · Amount: ₹4,999 · Your earnings: ₹4,749&quot;</em>
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <X className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>
            Notification delivery is best-effort — failures here never affect
            your payments or leads.
          </span>
        </div>
      </div>
    </div>
  );
}
