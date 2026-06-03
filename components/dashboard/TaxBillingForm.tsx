"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { saveGstProfileAction } from "@/actions/gst";
import { ALLOWED_GST_RATES, GSTIN_REGEX } from "@/lib/gst";

interface Props {
  states: Array<{ code: string; name: string }>;
  verifiedAt: string | null;
  stateLabel: string;
  defaults: {
    legal_business_name: string;
    gstin: string;
    state_code: string;
    default_hsn_sac: string;
    default_gst_rate: number;
    address_line1: string;
    address_line2: string;
    city: string;
    pincode: string;
  };
}

export function TaxBillingForm({ states, verifiedAt, defaults, stateLabel }: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(defaults);
  const [saved, setSaved] = useState<string | null>(verifiedAt);

  function bind<K extends keyof typeof form>(key: K) {
    return {
      value: form[key] as string | number,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((p) => ({ ...p, [key]: e.target.value })),
    };
  }

  const gstinUpper = form.gstin.trim().toUpperCase();
  const gstinValid = GSTIN_REGEX.test(gstinUpper);
  const gstinMatchesState =
    !gstinValid || gstinUpper.slice(0, 2) === form.state_code;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveGstProfileAction({
        legal_business_name: form.legal_business_name,
        gstin: gstinUpper,
        state_code: form.state_code,
        default_hsn_sac: form.default_hsn_sac.trim(),
        default_gst_rate: Number(form.default_gst_rate),
        address_line1: form.address_line1,
        address_line2: form.address_line2 || undefined,
        city: form.city,
        pincode: form.pincode,
      });
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't save",
          description: res.message,
        });
        return;
      }
      setSaved(new Date().toISOString());
      toast({
        title: "GST profile saved",
        description: "Invoices will use this profile from your next sale.",
      });
    });
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      {saved && (
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-900/10">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
            <div>
              <p className="font-medium">GST profile verified</p>
              <p className="text-xs text-muted-foreground">
                Saved {new Date(saved).toLocaleString("en-IN")} · State of registration: {stateLabel}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business identity</CardTitle>
          <CardDescription>
            What appears on every invoice as the seller.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Legal business name">
            <Input {...bind("legal_business_name")} required minLength={3} />
          </Field>
          <Field
            label="GSTIN"
            helper={
              !form.gstin
                ? "15-char GSTIN — e.g. 27ABCDE1234F1Z5"
                : gstinValid
                  ? gstinMatchesState
                    ? "Looks good ✓"
                    : "GSTIN state prefix doesn't match the state below"
                  : "Format must be NN ABCDE NNNN A 1 Z X"
            }
            tone={
              !form.gstin
                ? "muted"
                : gstinValid && gstinMatchesState
                  ? "good"
                  : "bad"
            }
          >
            <Input
              {...bind("gstin")}
              maxLength={15}
              required
              autoCapitalize="characters"
              style={{ textTransform: "uppercase" }}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered address</CardTitle>
          <CardDescription>
            Indian principal place of business as filed with the GST portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Address line 1" className="md:col-span-2">
            <Input {...bind("address_line1")} required />
          </Field>
          <Field label="Address line 2 (optional)" className="md:col-span-2">
            <Input {...bind("address_line2")} />
          </Field>
          <Field label="City">
            <Input {...bind("city")} required />
          </Field>
          <Field label="Pincode">
            <Input
              {...bind("pincode")}
              maxLength={6}
              inputMode="numeric"
              required
            />
          </Field>
          <Field label="State (code)">
            <Select
              value={form.state_code}
              onValueChange={(v) => setForm((p) => ({ ...p, state_code: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {states.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.code} · {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Defaults for new invoices</CardTitle>
          <CardDescription>
            HSN/SAC is the harmonised service/product code. GST rate applies to
            every line unless you set a product-level override later.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="HSN / SAC code">
            <Input
              {...bind("default_hsn_sac")}
              required
              inputMode="numeric"
              maxLength={8}
              placeholder="e.g. 999293"
            />
          </Field>
          <Field label="Default GST rate">
            <Select
              value={String(form.default_gst_rate)}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, default_gst_rate: Number(v) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALLOWED_GST_RATES.map((r) => (
                  <SelectItem key={r} value={String(r)}>
                    {r}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save GST profile
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  helper,
  tone,
  className,
}: {
  label: string;
  children: React.ReactNode;
  helper?: string;
  tone?: "muted" | "good" | "bad";
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 inline-block text-sm">{label}</Label>
      {children}
      {helper && (
        <p
          className={
            "mt-1 text-xs " +
            (tone === "bad"
              ? "text-destructive"
              : tone === "good"
                ? "text-emerald-600 dark:text-emerald-300"
                : "text-muted-foreground")
          }
        >
          {helper}
        </p>
      )}
    </div>
  );
}
