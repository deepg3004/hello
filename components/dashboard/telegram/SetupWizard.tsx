"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Loader2,
  Plus,
  Send,
  Trash2,
  Users,
} from "lucide-react";

import {
  saveTelegramSetupAction,
  verifyBotTokenAction,
  verifyGroupAction,
  type TelegramPlanInput,
} from "@/actions/telegram";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PageOption {
  id: string;
  title: string;
  template_id: string;
}

interface SetupWizardProps {
  pages: PageOption[];
  appUrl: string;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 1, label: "Bot token" },
  { id: 2, label: "Add to group" },
  { id: 3, label: "Group id" },
  { id: 4, label: "Access" },
  { id: 5, label: "Plans" },
  { id: 6, label: "Link page" },
];

/** Default plan rows shown when seller opens step 5. Seller can edit, add,
 *  or remove rows. Empty list means "use single-tier flow (access duration)". */
const DEFAULT_PLAN_TEMPLATES: TelegramPlanInput[] = [
  { label: "Weekly",   duration_days: 7,    price: 99 },
  { label: "Monthly",  duration_days: 30,   price: 299 },
  { label: "Yearly",   duration_days: 365,  price: 2499 },
  { label: "Lifetime", duration_days: null, price: 4999 },
];

const DURATIONS: Array<{ label: string; days: number }> = [
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "Lifetime", days: 0 },
];

export function SetupWizard({ pages, appUrl }: SetupWizardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [botToken, setBotToken] = useState("");
  const [bot, setBot] = useState<{ username: string; first_name: string; id: number } | null>(null);
  const [verifyingToken, setVerifyingToken] = useState(false);

  // Step 3
  const [groupInput, setGroupInput] = useState("");
  const [group, setGroup] = useState<{ chat_id: string; title: string } | null>(null);
  const [verifyingGroup, setVerifyingGroup] = useState(false);

  // Step 4
  const [durationDays, setDurationDays] = useState<number>(30);
  const [autoRenew, setAutoRenew] = useState(false);

  // Step 5 — subscription plan tiers. Pre-seeded with the four common tiers,
  // seller adjusts prices / removes rows / adds custom ones.
  const [plans, setPlans] = useState<TelegramPlanInput[]>(
    DEFAULT_PLAN_TEMPLATES.map((p) => ({ ...p })),
  );

  // Step 6
  const [pageId, setPageId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function verifyToken() {
    setVerifyingToken(true);
    const r = await verifyBotTokenAction(botToken);
    setVerifyingToken(false);
    if (!r.ok || !r.data) {
      toast({ title: "Couldn't verify bot", description: r.message, variant: "destructive" });
      return;
    }
    setBot(r.data);
    setStep(2);
  }

  async function verifyGroup() {
    setVerifyingGroup(true);
    const r = await verifyGroupAction(botToken, groupInput);
    setVerifyingGroup(false);
    if (!r.ok || !r.data) {
      toast({ title: "Couldn't verify group", description: r.message, variant: "destructive" });
      return;
    }
    setGroup({ chat_id: r.data.chat_id, title: r.data.title });
    setStep(4);
  }

  async function finish() {
    if (!bot || !group) return;
    // Drop empty rows. Plans only saved if a page is linked.
    const cleanPlans = plans
      .map((p) => ({
        label: p.label.trim(),
        duration_days: p.duration_days,
        price: Number(p.price) || 0,
      }))
      .filter((p) => p.label.length > 0 && p.price > 0);

    setSaving(true);
    const r = await saveTelegramSetupAction({
      bot_token: botToken,
      bot_username: bot.username,
      group_id: groupInput,
      group_chat_id: group.chat_id,
      group_name: group.title,
      access_duration_days: durationDays,
      auto_renewal_enabled: autoRenew,
      page_id: pageId || undefined,
      plans: pageId ? cleanPlans : undefined,
    });
    setSaving(false);
    if (!r.ok) {
      toast({ title: "Save failed", description: r.message, variant: "destructive" });
      return;
    }
    if (r.message) {
      toast({ title: "Saved with a warning", description: r.message });
    } else {
      toast({ title: "Telegram VIP setup complete" });
    }
    router.push("/dashboard/telegram");
  }

  const telegramVipPages = pages.filter((p) => p.template_id === "telegram-vip");

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((s, idx) => {
          const active = step === s.id;
          const done = step > s.id;
          return (
            <li key={s.id} className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold",
                  active && "border-primary bg-primary text-primary-foreground",
                  done && "border-emerald-500 bg-emerald-500 text-white",
                  !active && !done && "border-foreground/20 text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : s.id}
              </span>
              <span className={cn(active ? "font-medium" : "text-muted-foreground")}>
                {s.label}
              </span>
              {idx < STEPS.length - 1 && <span className="h-px w-6 bg-border" />}
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4" /> Create your Telegram bot
            </CardTitle>
            <CardDescription>
              Open Telegram, message <strong>@BotFather</strong>, type{" "}
              <code>/newbot</code>, follow the prompts. Paste the token below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Bot token</Label>
              <Input
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456789:ABCdefGhIJklmNOpQRStuvWXyz"
                className="font-mono text-xs"
              />
            </div>
            <Button onClick={verifyToken} disabled={!botToken || verifyingToken}>
              {verifyingToken && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify bot
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && bot && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Add the bot to your group
            </CardTitle>
            <CardDescription>
              Bot found: <strong>@{bot.username}</strong> ({bot.first_name})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Open your Telegram VIP group.</li>
              <li>Tap the group name → <strong>Add members</strong> → search <code>@{bot.username}</code> → Add.</li>
              <li>
                Tap the group name → <strong>Administrators</strong> → Add Admin →
                pick the bot → enable <strong>Invite Users via Link</strong>{" "}
                and <strong>Ban Users</strong>.
              </li>
            </ol>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(3)}>
                I&apos;ve added the bot <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tell us the group</CardTitle>
            <CardDescription>
              Either the numeric chat id (<code>-100…</code>) or a @username for
              public groups.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Group id or @username</Label>
              <Input
                value={groupInput}
                onChange={(e) => setGroupInput(e.target.value)}
                placeholder="-1001234567890  or  @myvipgroup"
                className="font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Tip: forward any message from the group to{" "}
                <code>@RawDataBot</code> to see its numeric id.
              </p>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button onClick={verifyGroup} disabled={!groupInput || verifyingGroup}>
                {verifyingGroup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test bot permissions <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && group && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Access duration</CardTitle>
            <CardDescription>
              Group: <strong>{group.title}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Duration per purchase</Label>
              <Select
                value={String(durationDays)}
                onValueChange={(v) => setDurationDays(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.days} value={String(d.days)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start justify-between rounded-md border bg-muted/30 px-3 py-2">
              <div>
                <Label>Auto-renewal reminders</Label>
                <p className="text-xs text-muted-foreground">
                  Email at 3 days + 1 day before expiry with a renew link.
                </p>
              </div>
              <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(3)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(5)}>
                Continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription plans</CardTitle>
            <CardDescription>
              Define one or more pricing tiers. Buyers will pick one on the
              public page. Leave the list empty to keep the single Access
              duration from the previous step. Plans are saved only if you
              link a page in the next step.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {plans.map((p, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 rounded-md border bg-muted/20 p-3"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={p.label}
                      placeholder="Monthly"
                      onChange={(e) =>
                        setPlans((rows) =>
                          rows.map((r, i) =>
                            i === idx ? { ...r, label: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Duration</Label>
                    <Select
                      value={
                        p.duration_days === null
                          ? "lifetime"
                          : String(p.duration_days)
                      }
                      onValueChange={(v) =>
                        setPlans((rows) =>
                          rows.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  duration_days:
                                    v === "lifetime" ? null : Number(v),
                                }
                              : r,
                          ),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Weekly (7 days)</SelectItem>
                        <SelectItem value="14">14 days</SelectItem>
                        <SelectItem value="30">Monthly (30 days)</SelectItem>
                        <SelectItem value="90">Quarterly (90 days)</SelectItem>
                        <SelectItem value="180">6 months</SelectItem>
                        <SelectItem value="365">Yearly (365 days)</SelectItem>
                        <SelectItem value="lifetime">Lifetime</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Price (₹)</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={p.price === 0 ? "" : String(p.price)}
                      placeholder="299"
                      onChange={(e) =>
                        setPlans((rows) =>
                          rows.map((r, i) =>
                            i === idx
                              ? { ...r, price: Number(e.target.value) || 0 }
                              : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove plan"
                    onClick={() =>
                      setPlans((rows) => rows.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPlans((rows) => [
                  ...rows,
                  { label: "", duration_days: 30, price: 0 },
                ])
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add another tier
            </Button>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(4)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(6)}>
                Continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Link to a page</CardTitle>
            <CardDescription>
              We&apos;ll attach this Telegram setup to a payment page so every
              successful checkout issues an invite.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {telegramVipPages.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                You don&apos;t have a Telegram VIP page yet. You can still save
                this group and link it later from a page&apos;s editor.
              </p>
            ) : (
              <div>
                <Label>Page</Label>
                <Select
                  value={pageId || "none"}
                  onValueChange={(v) => setPageId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Don&apos;t link yet</SelectItem>
                    {telegramVipPages.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Webhook URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate font-mono">
                  {appUrl}/api/webhooks/telegram/&lt;new-id&gt;
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      `${appUrl}/api/webhooks/telegram/`,
                    );
                    toast({ title: "Copied" });
                  }}
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="mt-2">
                We&apos;ll set this on your bot automatically — it&apos;s how
                Telegram tells us when someone actually joins the group.
              </p>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(5)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button onClick={finish} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-1 h-4 w-4" /> Finish setup
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
