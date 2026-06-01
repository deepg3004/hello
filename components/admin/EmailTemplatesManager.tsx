"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Loader2, Mail, Plus, Eye, Pencil, Save, RotateCcw, Trash2, Send } from "lucide-react";

import {
  listEmailTemplatesAction,
  saveEmailTemplateAction,
  resetEmailTemplateAction,
  deleteCustomTemplateAction,
  previewTemplateAction,
  sendTemplateTestAction,
  broadcastTemplateAction,
  type TemplateListItem,
} from "@/actions/email-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ROLES = ["kyc", "seller", "buyer", "support", "noreply", "onboarding", "billing", "legal"];
const AUDIENCES = ["Seller", "KYC", "Billing", "Buyer", "Other"];
const AUDIENCE_ORDER = ["Seller", "KYC", "Billing", "Buyer", "Other"];

type Draft = {
  key: string;
  name: string;
  audience: string;
  role: string;
  subject: string;
  body_html: string;
  use_shell: boolean;
  enabled: boolean;
  is_custom: boolean;
  isNew: boolean;
};

function toDraft(it: TemplateListItem): Draft {
  return {
    key: it.key,
    name: it.name,
    audience: it.audience,
    role: it.role,
    subject: it.subject,
    body_html: it.body_html,
    use_shell: it.use_shell,
    enabled: it.enabled,
    is_custom: it.isCustom,
    isNew: false,
  };
}

export function EmailTemplatesManager({ initial }: { initial: TemplateListItem[] }) {
  const { toast } = useToast();
  const [items, setItems] = useState<TemplateListItem[]>(initial);
  const [activeKey, setActiveKey] = useState(initial[0]?.key ?? "");
  const [tab, setTab] = useState<"preview" | "edit">("preview");
  const [draft, setDraft] = useState<Draft | null>(
    initial[0] ? toDraft(initial[0]) : null,
  );
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [recipients, setRecipients] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const activeItem = items.find((i) => i.key === activeKey);
  const placeholders = activeItem?.placeholders ?? [];

  const grouped = useMemo(() => {
    const m = new Map<string, TemplateListItem[]>();
    for (const it of items) {
      if (!m.has(it.audience)) m.set(it.audience, []);
      m.get(it.audience)!.push(it);
    }
    return AUDIENCE_ORDER.filter((a) => m.has(a)).map((a) => ({ audience: a, items: m.get(a)! }));
  }, [items]);

  const refreshPreview = useCallback(async (d: Draft) => {
    setPreviewing(true);
    const r = await previewTemplateAction({
      key: d.key || "custom",
      subject: d.subject,
      body_html: d.body_html,
      use_shell: d.use_shell,
    });
    setPreviewing(false);
    if (r.ok) setPreviewHtml((r.data as { html: string }).html);
  }, []);

  // Refresh preview when the active draft changes (debounced).
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => void refreshPreview(draft), 450);
    return () => clearTimeout(t);
  }, [draft, refreshPreview]);

  function select(key: string) {
    const it = items.find((i) => i.key === key);
    if (!it) return;
    setActiveKey(key);
    setDraft(toDraft(it));
    setTab("preview");
  }

  function startNew() {
    setActiveKey("");
    setDraft({
      key: "",
      name: "",
      audience: "Buyer",
      role: "buyer",
      subject: "",
      body_html: "<h2 style=\"margin:0 0 12px;font-size:20px\">Hello 👋</h2>\n<p>Write your message here. Use {{brand_name}} and other placeholders.</p>",
      use_shell: true,
      enabled: true,
      is_custom: true,
      isNew: true,
    });
    setTab("edit");
  }

  async function reloadList(keepKey?: string) {
    const r = await listEmailTemplatesAction();
    if (r.ok) {
      const list = r.data as TemplateListItem[];
      setItems(list);
      if (keepKey) {
        const it = list.find((i) => i.key === keepKey);
        if (it) {
          setActiveKey(keepKey);
          setDraft(toDraft(it));
        }
      }
    }
  }

  function patch(p: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }

  function insertPlaceholder(name: string) {
    const ta = bodyRef.current;
    const token = `{{${name}}}`;
    if (!ta || !draft) {
      patch({ body_html: (draft?.body_html ?? "") + token });
      return;
    }
    const start = ta.selectionStart ?? draft.body_html.length;
    const end = ta.selectionEnd ?? start;
    const next = draft.body_html.slice(0, start) + token + draft.body_html.slice(end);
    patch({ body_html: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + token.length;
    });
  }

  async function save() {
    if (!draft) return;
    setBusy("save");
    const r = await saveEmailTemplateAction({
      key: draft.key,
      name: draft.name,
      audience: draft.audience,
      role: draft.role,
      subject: draft.subject,
      body_html: draft.body_html,
      use_shell: draft.use_shell,
      enabled: draft.enabled,
      is_custom: draft.is_custom,
    });
    setBusy(null);
    if (!r.ok) {
      toast({ variant: "destructive", title: "Save failed", description: r.message });
      return;
    }
    toast({ title: "Saved" });
    await reloadList((r.data as { key: string })?.key ?? draft.key);
  }

  async function reset() {
    if (!draft) return;
    setBusy("reset");
    const r = await resetEmailTemplateAction(draft.key);
    setBusy(null);
    if (!r.ok) {
      toast({ variant: "destructive", title: "Couldn't reset", description: r.message });
      return;
    }
    toast({ title: "Reset to default" });
    await reloadList(draft.key);
  }

  async function del() {
    if (!draft || !draft.is_custom) return;
    if (!confirm(`Delete custom template "${draft.name}"?`)) return;
    setBusy("delete");
    const r = await deleteCustomTemplateAction(draft.key);
    setBusy(null);
    if (!r.ok) {
      toast({ variant: "destructive", title: "Delete failed", description: r.message });
      return;
    }
    toast({ title: "Deleted" });
    setDraft(null);
    setActiveKey("");
    await reloadList();
  }

  async function sendTest() {
    if (!draft) return;
    setBusy("test");
    const r = await sendTemplateTestAction(draft.key, testTo.trim(), draft.role);
    setBusy(null);
    toast({
      variant: r.ok ? "default" : "destructive",
      title: r.ok ? "Test sent" : "Test failed",
      description: r.message,
    });
  }

  async function broadcast() {
    if (!draft) return;
    if (!confirm("Send this email to the chosen recipients?")) return;
    setBusy("broadcast");
    const r = await broadcastTemplateAction(draft.key, draft.role, recipients.trim());
    setBusy(null);
    toast({
      variant: r.ok ? "default" : "destructive",
      title: r.ok ? "Broadcast started" : "Broadcast failed",
      description: r.message,
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      {/* ── Left: list ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <Button onClick={startNew} className="w-full gap-1.5" variant="outline">
          <Plus className="h-4 w-4" /> New template
        </Button>
        {grouped.map((g) => (
          <div key={g.audience}>
            <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.audience}
            </p>
            <div className="space-y-1">
              {g.items.map((it) => (
                <button
                  key={it.key}
                  onClick={() => select(it.key)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
                    it.key === activeKey
                      ? "border-primary/40 bg-primary/5 font-medium text-foreground"
                      : "border-transparent hover:border-border hover:bg-muted/50 text-muted-foreground",
                  )}
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{it.name}</span>
                  {it.isCustom && <Tag tone="indigo">custom</Tag>}
                  {!it.isCustom && it.edited && <Tag tone="emerald">edited</Tag>}
                  {!it.live && !it.isCustom && <Tag tone="amber">sample</Tag>}
                  {!it.enabled && <Tag tone="rose">off</Tag>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Right: preview / edit ───────────────────────────────────── */}
      {draft ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <h2 className="font-sora text-base font-semibold tracking-tight">
                {draft.isNew ? "New template" : draft.name}
              </h2>
              {!draft.isNew && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                  {draft.key}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              <TabBtn active={tab === "preview"} onClick={() => setTab("preview")} icon={Eye} label="Preview" />
              <TabBtn active={tab === "edit"} onClick={() => setTab("edit")} icon={Pencil} label="Edit" />
            </div>
          </div>

          {tab === "preview" ? (
            <div className="space-y-2">
              <p className="text-sm">
                <span className="text-muted-foreground">Subject:&nbsp;</span>
                <span className="font-medium">{draft.subject || "—"}</span>
              </p>
              <div className="relative overflow-hidden rounded-xl border border-border bg-[#f1f1f4]">
                {previewing && (
                  <div className="absolute right-2 top-2 z-10 rounded bg-background/80 px-2 py-1 text-[10px] text-muted-foreground">
                    rendering…
                  </div>
                )}
                <iframe title="preview" srcDoc={previewHtml} sandbox="" className="h-[620px] w-full border-0 bg-[#f1f1f4]" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {draft.isNew && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Template name">
                    <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Summer sale announcement" />
                  </Field>
                  <Field label="Audience (group)">
                    <Select value={draft.audience} onChange={(v) => patch({ audience: v })} options={AUDIENCES} />
                  </Field>
                </div>
              )}

              <Field label="Subject">
                <Input value={draft.subject} onChange={(e) => patch({ subject: e.target.value })} />
              </Field>

              <Field label="Body (HTML — use {{placeholders}})">
                <Textarea
                  ref={bodyRef}
                  value={draft.body_html}
                  onChange={(e) => patch({ body_html: e.target.value })}
                  className="min-h-[220px] font-mono text-xs"
                />
              </Field>

              {placeholders.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">Insert placeholder:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {placeholders.map((p) => (
                      <button
                        key={p}
                        onClick={() => insertPlaceholder(p)}
                        className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-[11px] transition hover:bg-muted"
                      >
                        {`{{${p}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Send-from mailbox">
                  <Select value={draft.role} onChange={(v) => patch({ role: v })} options={ROLES} />
                </Field>
                <div className="flex items-end gap-4 pb-1">
                  <Check label="Branded shell" checked={draft.use_shell} onChange={(v) => patch({ use_shell: v })} />
                  <Check label="Enabled" checked={draft.enabled} onChange={(v) => patch({ enabled: v })} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button onClick={save} disabled={busy === "save"} className="gap-1.5">
                  {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
                {!draft.isNew && !draft.is_custom && (
                  <Button onClick={reset} variant="outline" disabled={busy === "reset"} className="gap-1.5">
                    {busy === "reset" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Reset to default
                  </Button>
                )}
                {draft.is_custom && !draft.isNew && (
                  <Button onClick={del} variant="outline" disabled={busy === "delete"} className="gap-1.5 text-rose-600 hover:text-rose-700">
                    {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete
                  </Button>
                )}
              </div>

              {/* Send test + broadcast */}
              {!draft.isNew && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Send a test to">
                      <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" className="w-56" />
                    </Field>
                    <Button onClick={sendTest} variant="outline" disabled={busy === "test" || !testTo.trim()} className="gap-1.5">
                      {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send test
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Broadcast to (emails, or type all-sellers)">
                      <Textarea value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="a@x.com, b@y.com — or: all-sellers" className="min-h-[44px] w-72 text-xs" />
                    </Field>
                    <Button onClick={broadcast} variant="outline" disabled={busy === "broadcast" || !recipients.trim()} className="gap-1.5">
                      {busy === "broadcast" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Broadcast
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-12 text-sm text-muted-foreground">
          Select a template, or create a new one.
        </div>
      )}
    </div>
  );
}

// ── tiny helpers ─────────────────────────────────────────────────────────
function Tag({ tone, children }: { tone: "indigo" | "emerald" | "amber" | "rose"; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase", tones[tone])}>{children}</span>;
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Eye; label: string }) {
  return (
    <button onClick={onClick} className={cn("inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}
