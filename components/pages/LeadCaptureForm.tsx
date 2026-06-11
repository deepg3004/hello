"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { resolvedFormConfig, type FormConfig } from "@/lib/leads";
import { getRuntimePixelConfig } from "@/components/pages/PixelScripts";
import {
  fireGoogleLeadConversion,
  fireMetaLeadEvent,
} from "@/lib/pixel-events";
import { trackLead } from "@/lib/tracking/events";

interface LeadCaptureFormProps {
  pageId: string;
  /** Legacy props — formConfig overrides these when present. */
  ctaLabel?: string;
  requirePhone?: boolean;
  redirectUrl?: string;
  /** Live form configuration from page_config.form_config. */
  formConfig?: FormConfig;
  /** Theme accent — tints the submit button so the form matches the page. */
  primaryColor?: string;
}

export function LeadCaptureForm({
  pageId,
  ctaLabel,
  requirePhone,
  redirectUrl,
  formConfig,
  primaryColor,
}: LeadCaptureFormProps) {
  const { toast } = useToast();
  const cfg = resolvedFormConfig(formConfig);

  const nameEnabled = cfg.name_enabled !== false;
  const phoneEnabled = !!cfg.phone_enabled || !!requirePhone;
  const submitCta = ctaLabel ?? cfg.cta_text ?? "Submit";
  const fallbackRedirect = cfg.post_action === "redirect" ? cfg.redirect_url : undefined;
  const effectiveRedirect = redirectUrl ?? fallbackRedirect;
  const thanksText = cfg.thanks_text;
  const privacy = cfg.privacy_text;

  const [submitting, setSubmitting] = useState(false);
  const customFields = cfg.custom_fields ?? [];
  const [customValues, setCustomValues] = useState<
    Record<string, string | boolean>
  >({});
  const [customError, setCustomError] = useState<string | null>(null);
  const [done, setDone] = useState<
    | { kind: "thanks" }
    | { kind: "download"; url: string }
    | null
  >(null);

  const schema = z.object({
    name: nameEnabled
      ? z.string().min(2, "Enter your name")
      : z.string().optional(),
    email: z.string().email("Enter a valid email"),
    phone: phoneEnabled
      ? z.string().min(8, "Enter a valid phone number")
      : z.string().optional(),
  });
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "" },
  });

  async function onSubmit(values: FormValues) {
    // Validate required custom fields (they live outside react-hook-form).
    for (const f of customFields) {
      if (!f.required) continue;
      const v = customValues[f.key];
      const empty = f.type === "checkbox" ? !v : !String(v ?? "").trim();
      if (empty) {
        setCustomError(`Please complete: ${f.label}`);
        return;
      }
    }
    setCustomError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          name: values.name ?? "",
          email: values.email,
          phone: values.phone || null,
          custom_fields: customValues,
          source: typeof document !== "undefined" ? document.referrer || null : null,
          utm: parseUtmFromUrl(),
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        success?: boolean;
        error?: string;
        redirect_url?: string;
        download_url?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Submit failed");

      // Pixel fires — best-effort.
      try {
        const pixelCfg = getRuntimePixelConfig();
        if (pixelCfg) {
          fireMetaLeadEvent(pixelCfg.meta_pixel_id, {
            content_name: cfg.thanks_text,
          });
          fireGoogleLeadConversion(
            pixelCfg.google_ads_id,
            pixelCfg.google_ads_label,
            { value: 0 },
          );
        }
      } catch (pixelErr) {
        console.warn("[lead-form] pixel fire failed", pixelErr);
      }

      // First-party Lead event (separate from the pixel fire above so an
      // ad-blocker can't drop it). Seller id resolves from window.__INVOX_SELLER__.
      trackLead({ pageType: "lead" });

      const redirectTarget = effectiveRedirect ?? body.redirect_url;
      if (redirectTarget) {
        window.location.href = redirectTarget;
        return;
      }
      if (body.download_url) {
        setDone({ kind: "download", url: body.download_url });
        return;
      }
      setDone({ kind: "thanks" });
    } catch (e) {
      toast({
        title: "Couldn't submit",
        description: e instanceof Error ? e.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (done?.kind === "thanks") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        <p className="font-medium">You&apos;re in.</p>
        <p className="text-sm text-muted-foreground">
          {thanksText ?? "Check your inbox in a few minutes."}
        </p>
      </div>
    );
  }
  if (done?.kind === "download") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        <p className="font-medium">Your download is ready.</p>
        <Button
          asChild
          className="w-full"
          style={primaryColor ? { backgroundColor: primaryColor } : undefined}
        >
          <Link href={done.url} target="_blank" rel="noreferrer">
            <Download className="mr-2 h-4 w-4" /> Download now
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground">
          We also emailed it to you. Link expires in 7 days.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        {nameEnabled && (
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="name"
                    placeholder={cfg.name_placeholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder={cfg.email_placeholder ?? "you@example.com"}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {phoneEnabled && (
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    autoComplete="tel"
                    placeholder={cfg.phone_placeholder ?? "+91 98765 43210"}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {/* Seller-defined custom fields */}
        {customFields.map((f) => {
          const val = customValues[f.key];
          const set = (v: string | boolean) =>
            setCustomValues((p) => ({ ...p, [f.key]: v }));
          if (f.type === "checkbox") {
            return (
              <label
                key={f.key}
                className="flex items-start gap-2 text-sm font-medium"
              >
                <input
                  type="checkbox"
                  checked={!!val}
                  onChange={(e) => set(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span>
                  {f.label}
                  {f.required && <span className="text-rose-500"> *</span>}
                </span>
              </label>
            );
          }
          return (
            <div key={f.key} className="space-y-1.5">
              <label className="text-sm font-medium">
                {f.label}
                {f.required && <span className="text-rose-500"> *</span>}
              </label>
              {f.type === "textarea" ? (
                <Textarea
                  rows={3}
                  placeholder={f.placeholder}
                  value={(val as string) ?? ""}
                  onChange={(e) => set(e.target.value)}
                />
              ) : f.type === "select" ? (
                <select
                  value={(val as string) ?? ""}
                  onChange={(e) => set(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">{f.placeholder ?? "Select…"}</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder={f.placeholder}
                  value={(val as string) ?? ""}
                  onChange={(e) => set(e.target.value)}
                />
              )}
            </div>
          );
        })}
        {customError && (
          <p className="text-xs font-medium text-rose-500">{customError}</p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={submitting}
          style={primaryColor ? { backgroundColor: primaryColor } : undefined}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitCta}
        </Button>
        {privacy && (
          <p className="pt-1 text-center text-xs text-muted-foreground">{privacy}</p>
        )}
      </form>
    </Form>
  );
}

function parseUtmFromUrl(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const out: Record<string, string> = {};
  const sp = new URLSearchParams(window.location.search);
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = sp.get(k);
    if (v) out[k] = v;
  }
  return out;
}
