"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeadMagnetUpload } from "./LeadMagnetUpload";
import type {
  CustomField,
  CustomFieldType,
  FormConfig,
  LeadMagnetMeta,
  PostSubmitAction,
} from "@/lib/leads";

interface FormBuilderTabProps {
  pageId: string;
  pageType: "payment" | "landing" | "lead_magnet";
  formConfig: FormConfig;
  leadMagnet: LeadMagnetMeta | null;
  onFormConfigChange: (next: FormConfig) => void;
}

export function FormBuilderTab({
  pageId,
  pageType,
  formConfig,
  leadMagnet,
  onFormConfigChange,
}: FormBuilderTabProps) {
  const isLeadPage = pageType === "landing" || pageType === "lead_magnet";

  if (!isLeadPage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Form builder</CardTitle>
          <CardDescription>
            Form builder only applies to landing and lead-magnet pages.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const set = <K extends keyof FormConfig>(key: K, value: FormConfig[K]) =>
    onFormConfigChange({ ...formConfig, [key]: value });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fields</CardTitle>
          <CardDescription>Email is always required. Toggle the rest.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Row label="Show name field" hint="Required when on">
            <Switch
              checked={formConfig.name_enabled !== false}
              onCheckedChange={(v) => set("name_enabled", v)}
            />
          </Row>
          <Row label="Show phone field">
            <Switch
              checked={!!formConfig.phone_enabled}
              onCheckedChange={(v) => set("phone_enabled", v)}
            />
          </Row>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Name placeholder</Label>
              <Input
                value={formConfig.name_placeholder ?? ""}
                onChange={(e) => set("name_placeholder", e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div>
              <Label className="text-xs">Email placeholder</Label>
              <Input
                value={formConfig.email_placeholder ?? ""}
                onChange={(e) => set("email_placeholder", e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label className="text-xs">Phone placeholder</Label>
              <Input
                value={formConfig.phone_placeholder ?? ""}
                onChange={(e) => set("phone_placeholder", e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <CustomFieldsCard
        fields={formConfig.custom_fields ?? []}
        onChange={(next) => set("custom_fields", next)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Copy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">CTA button text</Label>
            <Input
              value={formConfig.cta_text ?? ""}
              onChange={(e) => set("cta_text", e.target.value)}
              placeholder="Send me the file"
            />
          </div>
          <div>
            <Label className="text-xs">Privacy / fine print</Label>
            <Input
              value={formConfig.privacy_text ?? ""}
              onChange={(e) => set("privacy_text", e.target.value)}
              placeholder="We respect your inbox. Unsubscribe anytime."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">After submit</CardTitle>
          <CardDescription>What the visitor sees once they hit submit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Action</Label>
            <Select
              value={formConfig.post_action ?? "thanks"}
              onValueChange={(v) => set("post_action", v as PostSubmitAction)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thanks">Thank-you message</SelectItem>
                <SelectItem value="download">Show download button (lead magnet)</SelectItem>
                <SelectItem value="redirect">Redirect to a URL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formConfig.post_action === "redirect" && (
            <div>
              <Label className="text-xs">Redirect URL</Label>
              <Input
                value={formConfig.redirect_url ?? ""}
                onChange={(e) => set("redirect_url", e.target.value)}
                placeholder="https://…"
              />
            </div>
          )}
          {formConfig.post_action === "thanks" && (
            <div>
              <Label className="text-xs">Thank-you text</Label>
              <Textarea
                rows={2}
                value={formConfig.thanks_text ?? ""}
                onChange={(e) => set("thanks_text", e.target.value)}
                placeholder="You're in. Check your inbox."
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead magnet file</CardTitle>
          <CardDescription>
            Uploaded to private Supabase storage. Delivered as a signed link in
            the confirmation email (and shown after submit when the action is
            &quot;download&quot;).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadMagnetUpload pageId={pageId} initial={leadMagnet} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auto emails &amp; webhooks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Row label="Send confirmation email to the lead">
            <Switch
              checked={!!formConfig.confirmation_email_enabled}
              onCheckedChange={(v) => set("confirmation_email_enabled", v)}
            />
          </Row>
          {formConfig.confirmation_email_enabled && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <div>
                <Label className="text-xs">Subject</Label>
                <Input
                  value={formConfig.confirmation_email_subject ?? ""}
                  onChange={(e) => set("confirmation_email_subject", e.target.value)}
                  placeholder="Thanks for signing up"
                />
              </div>
              <div>
                <Label className="text-xs">Body</Label>
                <Textarea
                  rows={4}
                  value={formConfig.confirmation_email_body ?? ""}
                  onChange={(e) => set("confirmation_email_body", e.target.value)}
                  placeholder="Hey, thanks for signing up…"
                />
              </div>
            </div>
          )}

          <Row label="Email you when a new lead comes in">
            <Switch
              checked={formConfig.notify_seller !== false}
              onCheckedChange={(v) => set("notify_seller", v)}
            />
          </Row>

          <div>
            <Label className="text-xs">Outbound webhook (Zapier / Make / your own)</Label>
            <Input
              value={formConfig.webhook_url ?? ""}
              onChange={(e) => set("webhook_url", e.target.value)}
              placeholder="https://hooks.zapier.com/…"
              className="font-mono text-xs"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              We POST <code>{`{ lead_id, page_id, name, email, phone, custom_fields, tags, utm, source }`}</code>.
            </p>
          </div>

          <div>
            <Label className="text-xs">Auto-tags (comma-separated)</Label>
            <Input
              value={(formConfig.auto_tags ?? []).join(", ")}
              onChange={(e) =>
                set(
                  "auto_tags",
                  e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                )
              }
              placeholder="ebook, lead-magnet"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
];

function CustomFieldsCard({
  fields,
  onChange,
}: {
  fields: CustomField[];
  onChange: (next: CustomField[]) => void;
}) {
  function add() {
    const key = `field_${fields.length + 1}_${Math.random().toString(36).slice(2, 6)}`;
    onChange([
      ...fields,
      { key, label: "New field", type: "text", required: false },
    ]);
  }
  const update = (i: number, patch: Partial<CustomField>) =>
    onChange(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const remove = (i: number) => onChange(fields.filter((_, idx) => idx !== i));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Custom fields</CardTitle>
            <CardDescription>
              Collect extra info (country, company, goal…). Saved with each lead
              and sent to your webhook + CRM.
            </CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus className="mr-1 h-3 w-3" /> Add field
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.length === 0 && (
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
            No custom fields yet. Just name, email{" "}
            {"&"} phone are collected.
          </p>
        )}
        {fields.map((f, i) => (
          <div key={f.key} className="space-y-2 rounded-md border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Field {i + 1}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Label</Label>
                <Input
                  value={f.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Company"
                />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select
                  value={f.type}
                  onValueChange={(v) => update(i, { type: v as CustomFieldType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {f.type !== "checkbox" && (
              <div>
                <Label className="text-xs">Placeholder</Label>
                <Input
                  value={f.placeholder ?? ""}
                  onChange={(e) => update(i, { placeholder: e.target.value })}
                  placeholder="e.g. Acme Inc."
                />
              </div>
            )}
            {f.type === "select" && (
              <div>
                <Label className="text-xs">Options (one per line)</Label>
                <Textarea
                  rows={3}
                  value={(f.options ?? []).join("\n")}
                  onChange={(e) =>
                    update(i, {
                      options: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder={"India\nUSA\nUK"}
                />
              </div>
            )}
            <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <Label className="text-sm">Required</Label>
              <Switch
                checked={!!f.required}
                onCheckedChange={(v) => update(i, { required: v })}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}
