"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const STEPS = [
  "Briefing the designer…",
  "Writing your copy…",
  "Laying out sections…",
  "Polishing the design…",
];

export function AiGenerator({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    businessType: "",
    businessName: "",
    goal: "",
    audience: "",
    style: "",
    colors: "",
  });

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function generate() {
    if (!form.businessType.trim() || !form.businessName.trim()) {
      toast({
        variant: "destructive",
        title: "A little more, please",
        description: "Business type and name are required.",
      });
      return;
    }
    setPending(true);
    setStep(0);
    const ticker = setInterval(
      () => setStep((s) => (s + 1) % STEPS.length),
      2500,
    );
    try {
      const res = await fetch("/api/builder/ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        pageId?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.pageId) {
        throw new Error(data.error ?? "Generation failed.");
      }
      toast({ title: "Your page is ready", description: "Opening it in the editor…" });
      router.push(`/dashboard/builder/editor?page=${data.pageId}`);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Couldn't generate",
        description: e instanceof Error ? e.message : String(e),
      });
      setPending(false);
    } finally {
      clearInterval(ticker);
    }
  }

  return (
    <Card className="animate-in-up">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl tile-violet">
            <Sparkles className="h-4 w-4" />
          </span>
          AI website generator
        </CardTitle>
        <CardDescription>
          Describe your business and we&apos;ll design a premium landing page —
          copy, layout and theme — that you can then edit in the builder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business type *" hint="e.g. fitness coach, online course, design agency">
            <Input
              value={form.businessType}
              onChange={(e) => set("businessType", e.target.value)}
              placeholder="Fitness coaching"
              disabled={pending || disabled}
            />
          </Field>
          <Field label="Business name *">
            <Input
              value={form.businessName}
              onChange={(e) => set("businessName", e.target.value)}
              placeholder="PeakForm Studio"
              disabled={pending || disabled}
            />
          </Field>
          <Field label="Main goal" hint="What should visitors do?">
            <Input
              value={form.goal}
              onChange={(e) => set("goal", e.target.value)}
              placeholder="Book a free consultation"
              disabled={pending || disabled}
            />
          </Field>
          <Field label="Target audience">
            <Input
              value={form.audience}
              onChange={(e) => set("audience", e.target.value)}
              placeholder="Busy professionals, 25-45"
              disabled={pending || disabled}
            />
          </Field>
          <Field label="Style / tone">
            <Input
              value={form.style}
              onChange={(e) => set("style", e.target.value)}
              placeholder="Bold and energetic"
              disabled={pending || disabled}
            />
          </Field>
          <Field label="Colour preference">
            <Input
              value={form.colors}
              onChange={(e) => set("colors", e.target.value)}
              placeholder="Deep green & cream"
              disabled={pending || disabled}
            />
          </Field>
        </div>

        <Button onClick={generate} disabled={pending || disabled} className="w-full sm:w-auto">
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {STEPS[step]}
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Generate my page
            </>
          )}
        </Button>
        {disabled && (
          <p className="text-xs text-muted-foreground">
            The AI generator isn&apos;t enabled on this environment yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
