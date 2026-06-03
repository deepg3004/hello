"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  Send,
  Star,
  Trash2,
} from "lucide-react";

import {
  getTelegramConnectionAction,
  saveChannelSetupAction,
  saveChannelPageAction,
  publishChannelAction,
  type PublishPlanInput,
} from "@/actions/telegram-channels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ImageInput } from "@/components/ui/ImageInput";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ChannelType = "channel" | "supergroup" | "group";

interface TgChannel {
  id: string;
  accessHash?: string;
  title: string;
  type: ChannelType;
  username?: string;
  memberCount?: number;
  isCreator: boolean;
}

interface PlanRow {
  name: string;
  price: string;
  originalPrice: string;
  durationDays: number;
  durationLabel: string;
  description: string;
  isPopular: boolean;
}

const STEPS = ["Connect", "Select channel", "Page setup", "Plans & publish"];

const CATEGORIES = [
  "Trading & Finance",
  "Education",
  "Entertainment",
  "Health & Fitness",
  "Technology",
  "Business",
  "Lifestyle",
  "Sports",
  "News",
  "Other",
];

const DURATIONS: Array<{ label: string; days: number }> = [
  { label: "1 Day", days: 1 },
  { label: "7 Days", days: 7 },
  { label: "1 Month", days: 30 },
  { label: "3 Months", days: 90 },
  { label: "6 Months", days: 180 },
  { label: "1 Year", days: 365 },
  { label: "Lifetime", days: 0 },
];

const PRESETS: PlanRow[] = [
  { name: "1 Month", price: "499", originalPrice: "", durationDays: 30, durationLabel: "1 Month", description: "", isPopular: false },
  { name: "3 Months", price: "999", originalPrice: "", durationDays: 90, durationLabel: "3 Months", description: "", isPopular: true },
  { name: "6 Months", price: "1799", originalPrice: "", durationDays: 180, durationLabel: "6 Months", description: "", isPopular: false },
  { name: "Lifetime", price: "4999", originalPrice: "", durationDays: 0, durationLabel: "Lifetime", description: "", isPopular: false },
];

export function ConnectFlow({ commissionPercent }: { commissionPercent: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // step 1
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);
  const [tgUser, setTgUser] = useState<{ username?: string; name: string } | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneCodeHash, setPhoneCodeHash] = useState("");
  const [sessionKey, setSessionKey] = useState("");
  const [passwordNeeded, setPasswordNeeded] = useState(false);
  const [twoFaPassword, setTwoFaPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // step 2
  const [channels, setChannels] = useState<TgChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [selected, setSelected] = useState<TgChannel | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAbout, setNewAbout] = useState("");

  // step 3
  const [groupDbId, setGroupDbId] = useState("");
  const [pageName, setPageName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // step 4
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [published, setPublished] = useState<{ slug: string; pageUrl: string } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await getTelegramConnectionAction();
      if (res.ok && res.data?.connected) {
        setConnected(true);
        setTgUser({ username: res.data.telegramUser?.username, name: res.data.telegramUser?.name ?? "" });
      }
      setChecking(false);
    })();
  }, []);

  const loadChannels = useCallback(async (refresh = false) => {
    setLoadingChannels(true);
    try {
      const res = await fetch(`/api/telegram/user/channels${refresh ? "?refresh=1" : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load channels");
      setChannels(json.channels ?? []);
    } catch (e) {
      toast({ title: "Couldn't load channels", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setLoadingChannels(false);
    }
  }, [toast]);

  useEffect(() => {
    if (step === 2 && connected) void loadChannels();
  }, [step, connected, loadChannels]);

  async function sendOtp() {
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/user/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to send OTP");
      setPhoneCodeHash(json.phoneCodeHash);
      setSessionKey(json.sessionKey);
      setOtpSent(true);
      toast({ title: "OTP sent", description: "Check your Telegram app." });
    } catch (e) {
      toast({ title: "Couldn't send OTP", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/user/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp, phoneCodeHash, sessionKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Verification failed");
      if (json.passwordNeeded) {
        setPasswordNeeded(true);
        toast({ title: "Two-step verification", description: "Enter your Telegram cloud password." });
        return;
      }
      setConnected(true);
      setTgUser({ username: json.telegramUser?.username ?? undefined, name: json.telegramUser?.name ?? "" });
      toast({ title: "Telegram connected" });
    } catch (e) {
      toast({ title: "Couldn't verify", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function verifyTwoFa() {
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/user/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: twoFaPassword, sessionKey, phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Wrong password");
      setConnected(true);
      setTgUser({ username: json.telegramUser?.username ?? undefined, name: json.telegramUser?.name ?? "" });
      toast({ title: "Telegram connected" });
    } catch (e) {
      toast({ title: "Couldn't verify password", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await fetch("/api/telegram/user/disconnect", { method: "DELETE" });
    setConnected(false);
    setTgUser(null);
    setOtpSent(false);
    setOtp("");
  }

  async function createChannel() {
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/telegram/user/create-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, about: newAbout }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create channel");
      setShowCreate(false);
      setNewTitle("");
      setNewAbout("");
      await loadChannels(true);
      toast({ title: "Channel created" });
    } catch (e) {
      toast({ title: "Couldn't create channel", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmChannel() {
    if (!selected) return;
    setBusy(true);
    try {
      const addRes = await fetch("/api/telegram/user/add-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: selected.id, channelType: selected.type, accessHash: selected.accessHash }),
      });
      const addJson = await addRes.json();
      if (!addRes.ok || !addJson.ok) throw new Error(addJson.message ?? "Couldn't add the bot");

      const save = await saveChannelSetupAction({
        chatId: selected.id,
        chatTitle: selected.title,
        channelType: selected.type,
        chatUsername: selected.username,
        memberCount: selected.memberCount,
      });
      if (!save.ok || !save.data) throw new Error(save.message ?? "Save failed");
      setGroupDbId(save.data.groupDbId);
      setPageName(selected.title);
      setStep(3);
    } catch (e) {
      toast({ title: "Setup failed", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function savePage() {
    if (!pageName.trim()) {
      toast({ title: "Page name is required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await saveChannelPageAction({
        groupDbId,
        pageName,
        pageDescription: description,
        category,
        logoUrl: logoUrl || undefined,
      });
      if (!res.ok) throw new Error(res.message);
      if (plans.length === 0) setPlans([PRESETS[1]!]);
      setStep(4);
    } catch (e) {
      toast({ title: "Couldn't save page", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  function addPlan(preset?: PlanRow) {
    if (plans.length >= 6) return;
    setPlans((prev) => [
      ...prev,
      preset ?? { name: "", price: "", originalPrice: "", durationDays: 30, durationLabel: "1 Month", description: "", isPopular: false },
    ]);
  }

  function updatePlan(i: number, patch: Partial<PlanRow>) {
    setPlans((prev) =>
      prev.map((p, idx) => {
        if (idx !== i) return patch.isPopular ? { ...p, isPopular: false } : p;
        return { ...p, ...patch };
      }),
    );
  }

  async function publish() {
    const valid = plans.filter((p) => p.name.trim() && Number(p.price) > 0);
    if (valid.length === 0) {
      toast({ title: "Add at least one valid plan (name + price)", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const payload: PublishPlanInput[] = valid.map((p, i) => ({
        name: p.name.trim(),
        description: p.description || undefined,
        price: Number(p.price),
        originalPrice: p.originalPrice ? Number(p.originalPrice) : undefined,
        durationDays: p.durationDays,
        durationLabel: p.durationLabel,
        isPopular: p.isPopular,
        sortOrder: i,
      }));
      const res = await publishChannelAction({ groupDbId, plans: payload, autoRenewal });
      if (!res.ok || !res.data) throw new Error(res.message ?? "Publish failed");
      setPublished(res.data);
    } catch (e) {
      toast({ title: "Couldn't publish", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (published) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-5 p-8 text-center">
          <div className="text-4xl">🎉</div>
          <h2 className="text-2xl font-sora font-semibold">Your channel is live!</h2>
          <p className="text-sm text-muted-foreground">{pageName}</p>
          <code className="block truncate rounded-md border bg-muted/40 px-3 py-2 text-sm">{published.pageUrl}</code>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(published.pageUrl); toast({ title: "Link copied" }); }}>
              <Copy className="mr-2 h-4 w-4" /> Copy link
            </Button>
            <Button asChild variant="outline">
              <Link href={published.pageUrl} target="_blank"><ExternalLink className="mr-2 h-4 w-4" /> Preview</Link>
            </Button>
          </div>
          <Button className="w-full" onClick={() => router.push(`/dashboard/telegram/${groupDbId}`)}>
            Go to channel dashboard <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium", step >= n ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
                {step > n ? <Check className="h-4 w-4" /> : n}
              </div>
              <span className={cn("hidden text-xs sm:inline", step >= n ? "text-foreground" : "text-muted-foreground")}>{label}</span>
              {n < STEPS.length && <div className="h-px flex-1 bg-border" />}
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-5 p-6 sm:p-8">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-sora font-semibold">Connect your Telegram account</h2>
                <p className="mt-1 text-sm text-muted-foreground">We use your phone number to securely connect to Telegram and show your channels.</p>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                🔒 Your Telegram credentials are never stored — we keep only an encrypted session token, the same way Telegram Desktop works.
              </div>

              {checking ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking…</div>
              ) : connected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Check className="h-4 w-4" /> {tgUser?.username ? `@${tgUser.username}` : tgUser?.name || "Account"} connected
                  </div>
                  <div className="flex items-center justify-between">
                    <button onClick={disconnect} className="text-xs text-muted-foreground hover:underline">Disconnect</button>
                    <Button onClick={() => setStep(2)}>Continue <ChevronRight className="ml-1 h-4 w-4" /></Button>
                  </div>
                </div>
              ) : !otpSent ? (
                <div className="space-y-3">
                  <Label>Phone number</Label>
                  <div className="flex gap-2">
                    <span className="flex items-center rounded-md border bg-muted/40 px-3 text-sm">🇮🇳 +91</span>
                    <Input inputMode="numeric" placeholder="10-digit number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <Button className="w-full" disabled={busy || phone.replace(/\D/g, "").length < 10} onClick={sendOtp}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Send OTP
                  </Button>
                </div>
              ) : passwordNeeded ? (
                <div className="space-y-3">
                  <Label>Two-step verification password</Label>
                  <Input
                    type="password"
                    placeholder="Your Telegram cloud password"
                    value={twoFaPassword}
                    onChange={(e) => setTwoFaPassword(e.target.value)}
                  />
                  <Button className="w-full" disabled={busy || !twoFaPassword} onClick={verifyTwoFa}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Verify password
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    This is your Telegram 2FA password (cloud password), not the OTP code.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Label>Enter the code sent to your Telegram app</Label>
                  <Input inputMode="numeric" maxLength={6} placeholder="• • • • •" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className="text-center text-lg tracking-[0.5em]" />
                  <Button className="w-full" disabled={busy || otp.length < 5} onClick={verifyOtp}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Verify OTP
                  </Button>
                  <button onClick={() => { setOtpSent(false); setOtp(""); }} className="block w-full text-center text-xs text-muted-foreground hover:underline">Change number</button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-sora font-semibold">Select your channel or group</h2>
                <p className="mt-1 text-sm text-muted-foreground">Pick a channel you admin, or create a new one. We&apos;ll add the InvoxAI bot as admin.</p>
              </div>

              <button onClick={() => setShowCreate((s) => !s)} className="flex w-full items-center gap-2 rounded-md border border-dashed p-3 text-sm hover:bg-muted/40">
                <Plus className="h-4 w-4" /> Create a new Telegram channel
              </button>
              {showCreate && (
                <div className="space-y-2 rounded-md border p-3">
                  <Input placeholder="Channel title" maxLength={128} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                  <Input placeholder="Description (optional)" value={newAbout} onChange={(e) => setNewAbout(e.target.value)} />
                  <Button size="sm" disabled={busy || !newTitle.trim()} onClick={createChannel}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create channel
                  </Button>
                </div>
              )}

              {loadingChannels ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />)}
                </div>
              ) : channels.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No channels found. Create one, or make sure you&apos;re an admin of a Telegram channel/group.</p>
              ) : (
                <div className="space-y-2">
                  {channels.map((c) => (
                    <button key={c.id} onClick={() => setSelected(c)} className={cn("flex w-full items-center gap-3 rounded-md border p-3 text-left", selected?.id === c.id ? "border-indigo-500 border-2 bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-muted/40")}>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0088cc] text-sm font-semibold text-white">{c.title.slice(0, 2).toUpperCase()}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{c.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.type}{c.username ? ` · @${c.username}` : ""}{c.memberCount ? ` · 👥 ${c.memberCount.toLocaleString("en-IN")}` : ""} · {c.isCreator ? "Creator" : "Admin"}
                        </div>
                      </div>
                      <div className={cn("h-4 w-4 rounded-full border", selected?.id === c.id ? "border-indigo-500 bg-indigo-500" : "border-muted-foreground")} />
                    </button>
                  ))}
                </div>
              )}

              {selected && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  ✅ Selected: {selected.title} — we&apos;ll add the InvoxAI bot as admin automatically.
                </div>
              )}
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button disabled={!selected || busy} onClick={confirmChannel}>
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding bot…</> : <>Continue <ChevronRight className="ml-1 h-4 w-4" /></>}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-sora font-semibold">Set up your page</h2>
                <p className="mt-1 text-sm text-muted-foreground">This is what subscribers see.</p>
              </div>
              <div className="space-y-2">
                <Label>Page name <span className="text-xs text-muted-foreground">({pageName.length}/75)</span></Label>
                <Input maxLength={75} value={pageName} onChange={(e) => setPageName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Description <span className="text-xs text-muted-foreground">({description.length}/2000)</span></Label>
                <textarea className="min-h-[110px] w-full rounded-md border bg-background px-3 py-2 text-sm" maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell subscribers what they'll get inside your channel…" />
              </div>
              <div className="space-y-2">
                <Label>Logo <span className="text-xs text-muted-foreground">(optional — paste a URL or upload)</span></Label>
                <ImageInput value={logoUrl} onChange={setLogoUrl} />
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                <Button disabled={busy} onClick={savePage}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save &amp; continue</Button>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-sora font-semibold">Create subscription plans</h2>
                <p className="mt-1 text-sm text-muted-foreground">Subscribers choose one. Add multiple options to maximise conversions.</p>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Auto-renewal reminders</div>
                  <div className="text-xs text-muted-foreground">Remind members before expiry so they can renew.</div>
                </div>
                <Switch checked={autoRenewal} onCheckedChange={setAutoRenewal} />
              </div>

              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Button key={p.name} size="sm" variant="outline" onClick={() => addPlan(p)} disabled={plans.length >= 6}>+ {p.name}</Button>
                ))}
              </div>

              <div className="space-y-3">
                {plans.map((p, i) => (
                  <div key={i} className="space-y-2 rounded-md border p-3">
                    <div className="flex gap-2">
                      <Input placeholder="Plan name" value={p.name} onChange={(e) => updatePlan(i, { name: e.target.value })} />
                      <select className="h-10 rounded-md border bg-background px-2 text-sm" value={p.durationDays} onChange={(e) => { const d = DURATIONS.find((x) => x.days === Number(e.target.value))!; updatePlan(i, { durationDays: d.days, durationLabel: d.label }); }}>
                        {DURATIONS.map((d) => <option key={d.days} value={d.days}>{d.label}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex items-center rounded-md border px-2 text-sm">₹<Input className="border-0 focus-visible:ring-0" inputMode="numeric" placeholder="Price" value={p.price} onChange={(e) => updatePlan(i, { price: e.target.value.replace(/\D/g, "") })} /></div>
                      <div className="flex items-center rounded-md border px-2 text-sm text-muted-foreground">₹<Input className="border-0 focus-visible:ring-0" inputMode="numeric" placeholder="Original (optional)" value={p.originalPrice} onChange={(e) => updatePlan(i, { originalPrice: e.target.value.replace(/\D/g, "") })} /></div>
                    </div>
                    <Input placeholder="Short description (optional)" value={p.description} onChange={(e) => updatePlan(i, { description: e.target.value })} />
                    <div className="flex items-center justify-between">
                      <button onClick={() => updatePlan(i, { isPopular: !p.isPopular })} className={cn("inline-flex items-center gap-1 text-xs", p.isPopular ? "text-amber-600 dark:text-amber-300" : "text-muted-foreground")}>
                        <Star className={cn("h-3.5 w-3.5", p.isPopular && "fill-amber-500")} /> Most popular
                      </button>
                      <button onClick={() => setPlans((prev) => prev.filter((_, idx) => idx !== i))} disabled={plans.length <= 1} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-40">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addPlan()} disabled={plans.length >= 6}><Plus className="mr-1 h-4 w-4" /> Add plan</Button>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                You&apos;re creating {plans.length} plan(s). InvoxAI deducts {commissionPercent}% per transaction; you receive the rest.
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
                <Button disabled={busy} onClick={publish}>
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing…</> : <>🚀 Publish channel page</>}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
