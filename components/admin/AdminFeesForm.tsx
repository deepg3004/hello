"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { updateSettingAction } from "@/actions/admin";
import { PLANS, type PlanKey } from "@/lib/plans";
import { BUILT_IN_FEE_CATEGORIES, DEFAULT_GST_PERCENT } from "@/lib/fees";

interface RuleInput {
  fixed: string; // rupees
  percent: string;
}
interface CategoryInput extends RuleInput {
  key: string;
  label: string;
}

const PLAN_KEYS = Object.keys(PLANS) as PlanKey[];

function parseRuleToInput(raw: string): RuleInput {
  try {
    const o = JSON.parse(raw) as { fixed_paise?: number; percent?: number };
    return {
      fixed: o?.fixed_paise ? String(o.fixed_paise / 100) : "",
      percent: o?.percent ? String(o.percent) : "",
    };
  } catch {
    return { fixed: "", percent: "" };
  }
}

function ruleToJson(r: RuleInput): string {
  const fixed = Math.max(0, Math.round(Number(r.fixed) * 100)) || 0;
  const percent = Math.max(0, Number(r.percent)) || 0;
  return JSON.stringify({ fixed_paise: fixed, percent });
}

export function AdminFeesForm({
  defaultJson,
  byPlanJson,
  categoriesJson,
  gstPercent,
}: {
  defaultJson: string;
  byPlanJson: string;
  categoriesJson: string;
  gstPercent: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [def, setDef] = useState<RuleInput>(() => parseRuleToInput(defaultJson));
  const [gst, setGst] = useState<string>(() =>
    gstPercent !== "" ? gstPercent : String(DEFAULT_GST_PERCENT),
  );

  const [plans, setPlans] = useState<Record<string, RuleInput>>(() => {
    const out: Record<string, RuleInput> = {};
    let parsed: Record<string, unknown> = {};
    try {
      parsed = byPlanJson ? (JSON.parse(byPlanJson) as Record<string, unknown>) : {};
    } catch {
      parsed = {};
    }
    for (const k of PLAN_KEYS) {
      out[k] = parsed[k]
        ? parseRuleToInput(JSON.stringify(parsed[k]))
        : { fixed: "", percent: "" };
    }
    return out;
  });

  const [cats, setCats] = useState<CategoryInput[]>(() => {
    let list = BUILT_IN_FEE_CATEGORIES.map((c) => ({
      key: c.key,
      label: c.label,
      fixed: "",
      percent: "",
    }));
    try {
      if (categoriesJson) {
        const parsed = JSON.parse(categoriesJson) as Array<Record<string, unknown>>;
        if (Array.isArray(parsed) && parsed.length) {
          list = parsed.map((c) => ({
            key: String(c.key ?? ""),
            label: String(c.label ?? c.key ?? ""),
            fixed: c.fixed_paise ? String(Number(c.fixed_paise) / 100) : "",
            percent: c.percent ? String(c.percent) : "",
          }));
        }
      }
    } catch {
      /* keep built-ins */
    }
    return list;
  });

  function setPlan(k: string, patch: Partial<RuleInput>) {
    setPlans((p) => ({ ...p, [k]: { ...p[k], ...patch } }));
  }
  function setCat(i: number, patch: Partial<CategoryInput>) {
    setCats((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function save() {
    const byPlan: Record<string, { fixed_paise: number; percent: number }> = {};
    for (const k of PLAN_KEYS) {
      byPlan[k] = JSON.parse(ruleToJson(plans[k]));
    }
    const categories = cats
      .filter((c) => c.key.trim())
      .map((c) => {
        const r = JSON.parse(ruleToJson(c));
        return {
          key: c.key.trim(),
          label: c.label.trim() || c.key.trim(),
          fixed_paise: r.fixed_paise,
          percent: r.percent,
        };
      });

    startTransition(async () => {
      const gstPct = Math.max(0, Number(gst)) || 0;
      const results = await Promise.all([
        updateSettingAction("platform_fee_default", ruleToJson(def)),
        updateSettingAction("platform_fee_by_plan", JSON.stringify(byPlan)),
        updateSettingAction("platform_fee_categories", JSON.stringify(categories)),
        updateSettingAction("platform_fee_gst_percent", String(gstPct)),
      ]);
      const bad = results.find((r) => !r.ok);
      if (bad) {
        toast({ variant: "destructive", title: "Couldn't save fees", description: bad.message });
        return;
      }
      toast({ title: "Platform fees saved" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Effective fee per order = fixed ₹ + percent of order value. Most specific
        wins: <strong>category → plan → default</strong>. Leave both at 0 to fall
        back to the built-in per-plan fee.
      </p>

      {/* GST on the platform fee */}
      <div>
        <p className="mb-2 text-sm font-semibold">GST on platform fee</p>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-[11px]">GST (%)</Label>
            <Input
              value={gst}
              onChange={(e) => setGst(e.target.value)}
              placeholder={String(DEFAULT_GST_PERCENT)}
              inputMode="decimal"
              className="mt-1 h-9 w-24"
            />
          </div>
          <p className="pb-2 text-xs text-muted-foreground">
            Added on top of the fee and debited from the seller&apos;s wallet
            together with it (e.g. ₹30 fee + {gst || DEFAULT_GST_PERCENT}% GST).
          </p>
        </div>
      </div>

      {/* Default */}
      <div>
        <p className="mb-2 text-sm font-semibold">Default</p>
        <RuleRow
          value={def}
          onChange={(patch) => setDef((d) => ({ ...d, ...patch }))}
        />
      </div>

      {/* Per plan */}
      <div>
        <p className="mb-2 text-sm font-semibold">Per plan</p>
        <div className="space-y-2">
          {PLAN_KEYS.map((k) => (
            <RuleRow
              key={k}
              label={PLANS[k].name}
              value={plans[k]}
              onChange={(patch) => setPlan(k, patch)}
            />
          ))}
        </div>
      </div>

      {/* Per category */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Per category</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setCats((cs) => [...cs, { key: "", label: "", fixed: "", percent: "" }])
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add category
          </Button>
        </div>
        <div className="space-y-2">
          {cats.map((c, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <div>
                <Label className="text-[11px]">Key</Label>
                <Input
                  value={c.key}
                  onChange={(e) => setCat(i, { key: e.target.value })}
                  placeholder="payment"
                  className="mt-1 h-9 w-32"
                />
              </div>
              <div>
                <Label className="text-[11px]">Label</Label>
                <Input
                  value={c.label}
                  onChange={(e) => setCat(i, { label: e.target.value })}
                  placeholder="Payment pages"
                  className="mt-1 h-9 w-40"
                />
              </div>
              <RuleRow value={c} onChange={(patch) => setCat(i, patch)} inline />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remove category"
                onClick={() => setCats((cs) => cs.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={save} disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save fees
      </Button>
    </div>
  );
}

function RuleRow({
  label,
  value,
  onChange,
  inline,
}: {
  label?: string;
  value: RuleInput;
  onChange: (patch: Partial<RuleInput>) => void;
  inline?: boolean;
}) {
  return (
    <div className={inline ? "flex items-end gap-2" : "flex flex-wrap items-end gap-3"}>
      {label && !inline && (
        <span className="w-20 text-sm text-muted-foreground">{label}</span>
      )}
      <div>
        <Label className="text-[11px]">Fixed (₹)</Label>
        <Input
          value={value.fixed}
          onChange={(e) => onChange({ fixed: e.target.value })}
          placeholder="0"
          inputMode="decimal"
          className="mt-1 h-9 w-24"
        />
      </div>
      <div>
        <Label className="text-[11px]">Percent (%)</Label>
        <Input
          value={value.percent}
          onChange={(e) => onChange({ percent: e.target.value })}
          placeholder="0"
          inputMode="decimal"
          className="mt-1 h-9 w-24"
        />
      </div>
    </div>
  );
}
