"use client";

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
import type { FormConfig, LeadMagnetMeta, PostSubmitAction } from "@/lib/leads";

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
