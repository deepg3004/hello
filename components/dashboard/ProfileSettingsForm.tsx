"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { updateProfileAction } from "@/actions/profile";
import { createClient } from "@/lib/supabase/client";
import { CREATOR_CATEGORIES } from "@/lib/creator-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Props {
  initialName: string;
  initialPhone: string;
  initialGstin: string;
  initialCategory: string;
}

/** Editable profile (name / phone / GSTIN / category) + a password-change block. */
export function ProfileSettingsForm({
  initialName,
  initialPhone,
  initialGstin,
  initialCategory,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [gstin, setGstin] = useState(initialGstin);
  const [category, setCategory] = useState(initialCategory);
  const [saving, setSaving] = useState(false);

  const dirty =
    name !== initialName ||
    phone !== initialPhone ||
    gstin !== initialGstin ||
    category !== initialCategory;

  async function save() {
    setSaving(true);
    const r = await updateProfileAction({
      full_name: name,
      phone,
      gstin,
      creator_category: category,
    });
    setSaving(false);
    if (!r.ok) {
      toast({ title: "Couldn't save", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Profile saved" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
        </Field>
        <Field label="GSTIN (optional)">
          <Input
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
            className="font-mono uppercase"
          />
        </Field>
        <Field label="Creator category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">— Select your niche —</option>
            {CREATOR_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Button onClick={save} disabled={!dirty || saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save profile
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Password change — runs entirely client-side via the browser Supabase client
 * (Supabase has no server-side "set password for current user" without the
 * old password; updateUser uses the active session).
 */
export function PasswordChangeForm() {
  const { toast } = useToast();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function change() {
    if (pw.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (pw !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't update password", description: error.message, variant: "destructive" });
      return;
    }
    setPw("");
    setConfirm("");
    toast({ title: "Password updated" });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password">
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password">
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
      </div>
      <Button onClick={change} disabled={busy || !pw || !confirm}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Update password
      </Button>
    </div>
  );
}
