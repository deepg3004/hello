"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Loader2, Plus, Star, Trash2, Upload } from "lucide-react";

import {
  publishChannelAction,
  setChannelPublishedAction,
  type EditablePlan,
  type PublishPlanInput,
} from "@/actions/telegram-channels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { TG_THEMES, TG_ANIMATIONS } from "@/lib/telegram-themes";

const DURATIONS: Array<{ label: string; days: number }> = [
  { label: "1 Day", days: 1 },
  { label: "7 Days", days: 7 },
  { label: "1 Month", days: 30 },
  { label: "3 Months", days: 90 },
  { label: "6 Months", days: 180 },
  { label: "1 Year", days: 365 },
  { label: "Lifetime", days: 0 },
];

interface Row {
  name: string;
  price: string;
  originalPrice: string;
  durationDays: number;
  durationLabel: string;
  description: string;
  isPopular: boolean;
}

function toRow(p: EditablePlan): Row {
  return {
    name: p.name,
    price: String(p.price),
    originalPrice: p.originalPrice != null ? String(p.originalPrice) : "",
    durationDays: p.durationDays,
    durationLabel: p.durationLabel,
    description: p.description ?? "",
    isPopular: p.isPopular,
  };
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function PlansEditor({
  groupDbId,
  groupName,
  initialPlans,
  initialAutoRenewal,
  initialPublished,
  initialOfferEndsAt,
  initialTheme,
  initialBgAnimation,
  initialLogoUrl,
  initialQuestions,
  pageUrl,
}: {
  groupDbId: string;
  groupName: string;
  initialPlans: EditablePlan[];
  initialAutoRenewal: boolean;
  initialPublished: boolean;
  initialOfferEndsAt: string | null;
  initialTheme: string;
  initialBgAnimation: string;
  initialLogoUrl: string | null;
  initialQuestions: Array<{ label: string; required: boolean }>;
  pageUrl: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [plans, setPlans] = useState<Row[]>(
    initialPlans.length
      ? initialPlans.map(toRow)
      : [{ name: "1 Month", price: "499", originalPrice: "", durationDays: 30, durationLabel: "1 Month", description: "", isPopular: false }],
  );
  const [autoRenewal, setAutoRenewal] = useState(initialAutoRenewal);
  const [published, setPublished] = useState(initialPublished);
  const [offerEndsAt, setOfferEndsAt] = useState(isoToLocalInput(initialOfferEndsAt));
  const [theme, setTheme] = useState(initialTheme || "purple");
  const [bgAnimation, setBgAnimation] = useState(initialBgAnimation || "none");
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl || "");
  const [uploading, setUploading] = useState(false);
  const [questions, setQuestions] = useState<Array<{ label: string; required: boolean }>>(
    initialQuestions ?? [],
  );
  const [saving, setSaving] = useState(false);

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/telegram/upload-logo", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setLogoUrl(json.url);
      toast({ title: "Logo uploaded" });
    } catch (e) {
      toast({ title: "Upload failed", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }
  const [toggling, setToggling] = useState(false);

  function update(i: number, patch: Partial<Row>) {
    setPlans((prev) =>
      prev.map((p, idx) => {
        if (idx !== i) return patch.isPopular ? { ...p, isPopular: false } : p;
        return { ...p, ...patch };
      }),
    );
  }

  async function save() {
    const valid = plans.filter((p) => p.name.trim() && Number(p.price) > 0);
    if (!valid.length) {
      toast({ title: "Add at least one valid plan (name + price)", variant: "destructive" });
      return;
    }
    setSaving(true);
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
      const res = await publishChannelAction({
        groupDbId,
        plans: payload,
        autoRenewal,
        offerEndsAt: offerEndsAt ? new Date(offerEndsAt).toISOString() : null,
        theme,
        bgAnimation,
        logoUrl: logoUrl || null,
        checkoutQuestions: questions.filter((q) => q.label.trim()),
      });
      if (!res.ok) throw new Error(res.message ?? "Save failed");
      setPublished(true);
      toast({ title: "Plans saved & page published" });
      router.refresh();
    } catch (e) {
      toast({ title: "Couldn't save", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    setToggling(true);
    try {
      const res = await setChannelPublishedAction(groupDbId, !published);
      if (!res.ok) throw new Error(res.message);
      setPublished(!published);
      toast({ title: !published ? "Page published" : "Page unpublished" });
      router.refresh();
    } catch (e) {
      toast({ title: "Couldn't update", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8">
          <Link href={`/dashboard/telegram/${groupDbId}`}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to channel
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-sora font-semibold tracking-tight">Edit plans — {groupName}</h1>
            <p className="text-sm text-muted-foreground">
              Set the price, original price (for the discount badge), duration and most-popular tag.
            </p>
          </div>
          <Button variant="outline" disabled={toggling} onClick={togglePublish}>
            {toggling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : published ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {published ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <div className="text-sm font-medium">Auto-renewal reminders</div>
          <div className="text-xs text-muted-foreground">Remind members before expiry so they can renew.</div>
        </div>
        <Switch checked={autoRenewal} onCheckedChange={setAutoRenewal} />
      </div>

      <div className="rounded-md border p-3">
        <div className="text-sm font-medium">Limited-time offer countdown</div>
        <div className="mb-2 text-xs text-muted-foreground">
          Optional. Shows a live countdown banner on the public page until this time. Leave empty for none.
        </div>
        <div className="flex items-center gap-2">
          <Input type="datetime-local" value={offerEndsAt} onChange={(e) => setOfferEndsAt(e.target.value)} className="max-w-xs" />
          {offerEndsAt && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setOfferEndsAt("")}>Clear</Button>
          )}
        </div>
      </div>

      <div className="rounded-md border p-3">
        <div className="mb-2 text-sm font-medium">Channel logo</div>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="logo" className="h-14 w-14 rounded-full border object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">No logo</div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted/40">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Upload image"}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
            </label>
            {logoUrl && (
              <button type="button" onClick={() => setLogoUrl("")} className="text-left text-xs text-muted-foreground hover:underline">
                Remove logo
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">PNG/JPG/WebP, up to 2 MB. Hosted on InvoxAI — reliable (pasted Google-image links get blocked).</p>
      </div>

      <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-sm font-medium">Page theme</div>
          <select value={theme} onChange={(e) => setTheme(e.target.value)} className="h-10 w-full rounded-md border bg-background px-2 text-sm">
            {Object.entries(TG_THEMES).map(([k, t]) => (
              <option key={k} value={k}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="mb-1 text-sm font-medium">Background animation</div>
          <select value={bgAnimation} onChange={(e) => setBgAnimation(e.target.value)} className="h-10 w-full rounded-md border bg-background px-2 text-sm">
            {TG_ANIMATIONS.map((a) => (
              <option key={a.key} value={a.key}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <div className="mb-1 text-sm font-medium">Checkout questions</div>
        <div className="mb-2 text-xs text-muted-foreground">
          Extra fields buyers answer at checkout (e.g. Telegram username, trading experience). Max 5.
        </div>
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={q.label}
                placeholder="Question (e.g. Your Telegram @username)"
                onChange={(e) =>
                  setQuestions((prev) => prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))
                }
              />
              <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) =>
                    setQuestions((prev) => prev.map((x, idx) => (idx === i ? { ...x, required: e.target.checked } : x)))
                  }
                />
                Required
              </label>
              <button
                type="button"
                onClick={() => setQuestions((prev) => prev.filter((_, idx) => idx !== i))}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Remove question"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {questions.length < 5 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuestions((prev) => [...prev, { label: "", required: false }])}
            >
              <Plus className="mr-1 h-4 w-4" /> Add question
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {plans.map((p, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 p-4">
              <div className="flex gap-2">
                <Input placeholder="Plan name" value={p.name} onChange={(e) => update(i, { name: e.target.value })} />
                <select
                  className="h-10 rounded-md border bg-background px-2 text-sm"
                  value={p.durationDays}
                  onChange={(e) => {
                    const d = DURATIONS.find((x) => x.days === Number(e.target.value))!;
                    update(i, { durationDays: d.days, durationLabel: d.label });
                  }}
                >
                  {DURATIONS.map((d) => <option key={d.days} value={d.days}>{d.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex flex-1 items-center rounded-md border px-2 text-sm">₹<Input className="border-0 focus-visible:ring-0" inputMode="numeric" placeholder="Price" value={p.price} onChange={(e) => update(i, { price: e.target.value.replace(/\D/g, "") })} /></div>
                <div className="flex flex-1 items-center rounded-md border px-2 text-sm text-muted-foreground">₹<Input className="border-0 focus-visible:ring-0" inputMode="numeric" placeholder="Original price (for % OFF)" value={p.originalPrice} onChange={(e) => update(i, { originalPrice: e.target.value.replace(/\D/g, "") })} /></div>
              </div>
              <Input placeholder="Short description (optional)" value={p.description} onChange={(e) => update(i, { description: e.target.value })} />
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => update(i, { isPopular: !p.isPopular })} className={`inline-flex items-center gap-1 text-xs ${p.isPopular ? "text-amber-600" : "text-muted-foreground"}`}>
                  <Star className={`h-3.5 w-3.5 ${p.isPopular ? "fill-amber-500" : ""}`} /> Most popular
                </button>
                <button type="button" onClick={() => setPlans((prev) => prev.filter((_, idx) => idx !== i))} disabled={plans.length <= 1} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-40">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={plans.length >= 6}
          onClick={() => setPlans((prev) => [...prev, { name: "", price: "", originalPrice: "", durationDays: 30, durationLabel: "1 Month", description: "", isPopular: false }])}
        >
          <Plus className="mr-1 h-4 w-4" /> Add plan
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        {pageUrl ? (
          <Button asChild variant="ghost" size="sm"><Link href={pageUrl} target="_blank">View public page</Link></Button>
        ) : <span />}
        <Button disabled={saving} onClick={save}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save changes
        </Button>
      </div>
    </div>
  );
}
