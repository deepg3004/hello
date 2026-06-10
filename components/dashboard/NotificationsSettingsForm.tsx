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
  NotificationChannel,
  NotificationEventKey,
  NotificationEventToggles,
} from "@/lib/notifications-config";

interface EventCatalogEntry {
  key: NotificationEventKey;
  label: string;
  description: string;
  channels: NotificationChannel[];
}

interface Props {
  initialEnabled: boolean;
  initialEvents: Required<NotificationEventToggles>;
  initialEmailEvents: Required<NotificationEventToggles>;
  initialInappEvents: Required<NotificationEventToggles>;
  initialSmsEvents: Required<NotificationEventToggles>;
  verifiedNumber: string | null;
  verifiedAt: string | null;
  pendingNumber: string | null;
  pendingExpiresAt: string | null;
  defaultPhone: string | null;
  eventCatalog: EventCatalogEntry[];
}

// Column order shown in the matrix.
const CHANNEL_COLUMNS: { channel: NotificationChannel; label: string }[] = [
  { channel: "inapp", label: "In-app" },
  { channel: "email", label: "Email" },
  { channel: "whatsapp", label: "WhatsApp" },
  { channel: "sms", label: "SMS" },
];

type Stage = "idle" | "sending" | "awaiting_otp" | "verifying";

export function NotificationsSettingsForm(props: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [enabled, setEnabled] = useState(props.initialEnabled);
  // One toggle map per channel, keyed by the engine's channel names.
  const [matrix, setMatrix] = useState<
    Record<NotificationChannel, Required<NotificationEventToggles>>
  >({
    whatsapp: props.initialEvents,
    email: props.initialEmailEvents,
    inapp: props.initialInappEvents,
    sms: props.initialSmsEvents,
  });

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
    inapp?: NotificationEventToggles;
    sms?: NotificationEventToggles;
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

  // The server action's field name matches the channel name for every channel
  // except WhatsApp, which is historically stored under `events`.
  const CHANNEL_FIELD: Record<
    NotificationChannel,
    "events" | "email" | "inapp" | "sms"
  > = {
    whatsapp: "events",
    email: "email",
    inapp: "inapp",
    sms: "sms",
  };

  function toggleChannel(
    channel: NotificationChannel,
    key: NotificationEventKey,
    value: boolean,
  ) {
    setMatrix((m) => ({
      ...m,
      [channel]: { ...m[channel], [key]: value },
    }));
    commitPrefs({ [CHANNEL_FIELD[channel]]: { [key]: value } });
  }

  // Per-channel disabled rule for the switches.
  function channelDisabled(channel: NotificationChannel): boolean {
    if (pending) return true;
    if (channel === "whatsapp") return !isVerified || !enabled;
    if (channel === "sms") return !isVerified; // SMS reuses the verified number
    return false; // in-app + email always available
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

      {/* ─── Event × channel matrix ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What we&apos;ll alert you about</CardTitle>
          <CardDescription>
            Pick exactly which channels fire for each event. In-app and email
            are on by default; WhatsApp needs the master switch above; SMS is
            opt-in and reuses your verified number.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <div className="grid grid-cols-[1fr_repeat(4,56px)] items-center gap-2 pb-3 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>Event</span>
            {CHANNEL_COLUMNS.map((c) => (
              <span key={c.channel} className="text-center">
                {c.label}
              </span>
            ))}
          </div>
          {props.eventCatalog.map((evt) => (
            <div
              key={evt.key}
              className="grid grid-cols-[1fr_repeat(4,56px)] items-center gap-2 py-3"
            >
              <div>
                <p className="text-sm font-medium">{evt.label}</p>
                <p className="text-xs text-muted-foreground">{evt.description}</p>
              </div>
              {CHANNEL_COLUMNS.map((c) =>
                evt.channels.includes(c.channel) ? (
                  <div key={c.channel} className="flex justify-center">
                    <Switch
                      checked={!!matrix[c.channel][evt.key]}
                      onCheckedChange={(v) => toggleChannel(c.channel, evt.key, v)}
                      disabled={channelDisabled(c.channel)}
                      aria-label={`${evt.label} — ${c.label}`}
                    />
                  </div>
                ) : (
                  <div
                    key={c.channel}
                    className="flex justify-center text-muted-foreground/40"
                    title="Not available for this event"
                  >
                    —
                  </div>
                ),
              )}
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
          <X className="h-3.5 w-3.5 text-muted-foreground dark:text-zinc-400" />
          <span>
            Notification delivery is best-effort — failures here never affect
            your payments or leads.
          </span>
        </div>
      </div>
    </div>
  );
}
