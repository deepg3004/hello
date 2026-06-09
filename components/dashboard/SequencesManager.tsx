"use client";

// Email-sequence builder: create sequences (name + trigger), add ordered steps
// (delay + subject + body), enable/disable, delete. Saves via actions/sequences.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  createSequenceAction,
  updateSequenceAction,
  deleteSequenceAction,
  saveStepsAction,
} from "@/actions/sequences";

type Trigger = "lead_created" | "purchase" | "manual";
interface Step {
  delay_hours: number;
  subject: string;
  body: string;
}
export interface SequenceWithSteps {
  id: string;
  name: string;
  trigger: Trigger;
  active: boolean;
  steps: Step[];
}

const TRIGGERS: Array<[Trigger, string]> = [
  ["lead_created", "When a lead is captured"],
  ["purchase", "After a purchase"],
  ["manual", "Manual only"],
];
const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function SequencesManager({ initial }: { initial: SequenceWithSteps[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState<Trigger>("lead_created");

  async function create() {
    if (!newName.trim()) {
      toast({ title: "Name your sequence", variant: "destructive" });
      return;
    }
    setBusy(true);
    const r = await createSequenceAction({ name: newName, trigger: newTrigger });
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't create", description: r.message, variant: "destructive" });
      return;
    }
    setNewName("");
    toast({ title: "Sequence created" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* New sequence */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold">New sequence</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. New lead welcome" className="flex-1" />
          <select value={newTrigger} onChange={(e) => setNewTrigger(e.target.value as Trigger)} className={`${inputCls} sm:w-56`}>
            {TRIGGERS.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          <Button onClick={create} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
            Create
          </Button>
        </div>
      </div>

      {initial.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          No sequences yet. Create one above — then add steps and turn it on.
        </div>
      ) : (
        initial.map((seq) => <SequenceCard key={seq.id} seq={seq} />)
      )}
    </div>
  );
}

function SequenceCard({ seq }: { seq: SequenceWithSteps }) {
  const router = useRouter();
  const { toast } = useToast();
  const [active, setActive] = useState(seq.active);
  const [steps, setSteps] = useState<Step[]>(seq.steps.length ? seq.steps : [{ delay_hours: 0, subject: "", body: "" }]);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle(v: boolean) {
    setActive(v);
    setBusy(true);
    const r = await updateSequenceAction({ id: seq.id, active: v });
    setBusy(false);
    if (!r.ok) {
      setActive(!v);
      toast({ title: "Couldn't update", description: r.message, variant: "destructive" });
    } else {
      toast({ title: v ? "Sequence is live" : "Sequence paused" });
    }
  }

  async function saveSteps() {
    setSaving(true);
    const r = await saveStepsAction({ sequenceId: seq.id, steps });
    setSaving(false);
    toast({
      title: r.ok ? "Steps saved" : "Couldn't save",
      description: r.ok ? undefined : r.message,
      variant: r.ok ? undefined : "destructive",
    });
  }

  async function remove() {
    if (!confirm(`Delete "${seq.name}"? This stops it and removes its steps.`)) return;
    setBusy(true);
    const r = await deleteSequenceAction(seq.id);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't delete", description: r.message, variant: "destructive" });
      return;
    }
    router.refresh();
  }

  const triggerLabel = TRIGGERS.find(([v]) => v === seq.trigger)?.[1] ?? seq.trigger;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{seq.name}</p>
          <p className="text-xs text-muted-foreground">{triggerLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={active} onCheckedChange={toggle} disabled={busy} />
            {active ? "Live" : "Paused"}
          </label>
          <Button variant="ghost" size="icon" onClick={remove} disabled={busy} className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Steps */}
      <div className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Mail className="h-3.5 w-3.5" /> Email {i + 1}
              </span>
              <button type="button" onClick={() => setSteps((st) => st.filter((_, j) => j !== i))} className="text-rose-500 hover:opacity-80">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground">
                Send after (hours from {i === 0 ? "enrollment" : "previous email"})
                <Input
                  type="number"
                  value={s.delay_hours}
                  onChange={(e) => setSteps((st) => st.map((x, j) => (j === i ? { ...x, delay_hours: Number(e.target.value) || 0 } : x)))}
                  className="mt-1"
                />
              </label>
              <Input
                value={s.subject}
                onChange={(e) => setSteps((st) => st.map((x, j) => (j === i ? { ...x, subject: e.target.value } : x)))}
                placeholder="Subject"
              />
              <textarea
                value={s.body}
                onChange={(e) => setSteps((st) => st.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
                placeholder="Body — use {{name}} and {{email}}"
                rows={4}
                className={inputCls}
              />
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSteps((st) => [...st, { delay_hours: 24, subject: "", body: "" }])}>
            <Plus className="mr-1.5 h-4 w-4" /> Add email
          </Button>
          <Button size="sm" onClick={saveSteps} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Save steps
          </Button>
        </div>
      </div>
    </div>
  );
}
