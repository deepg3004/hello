"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";

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
import { useToast } from "@/hooks/use-toast";

interface LeadCaptureFormProps {
  pageId: string;
  ctaLabel?: string;
  requirePhone?: boolean;
  /** Optional URL the buyer is redirected to after a successful submit. */
  redirectUrl?: string;
}

export function LeadCaptureForm({
  pageId,
  ctaLabel = "Submit",
  requirePhone = false,
  redirectUrl,
}: LeadCaptureFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const schema = z.object({
    name: z.string().min(2, "Enter your name"),
    email: z.string().email("Enter a valid email"),
    phone: requirePhone
      ? z.string().min(8, "Enter a valid phone number")
      : z.string().optional(),
  });
  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/lead-captures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          name: values.name,
          email: values.email,
          phone: values.phone || null,
          source: typeof document !== "undefined" ? document.referrer || null : null,
          utm: parseUtmFromUrl(),
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Submit failed");
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
      setDone(true);
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

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        <p className="font-medium">You&apos;re in.</p>
        <p className="text-sm text-muted-foreground">
          Check your inbox in a few minutes.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
                  placeholder="you@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {requirePhone && (
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
                    placeholder="+91 98765 43210"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {ctaLabel}
        </Button>
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
