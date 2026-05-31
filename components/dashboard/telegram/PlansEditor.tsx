"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Loader2, Plus, Star, Trash2 } from "lucide-react";

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

export function PlansEditor({
  groupDbId,
  groupName,
  initialPlans,
  initialAutoRenewal,
  initialPublished,
  pageUrl,
}: {
  groupDbId: string;
  groupName: string;
  initialPlans: EditablePlan[];
  initialAutoRenewal: boolean;
  initialPublished: boolean;
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
  const [saving, setSaving] = useState(false);
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
      const res = await publishChannelAction({ groupDbId, plans: payload, autoRenewal });
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
