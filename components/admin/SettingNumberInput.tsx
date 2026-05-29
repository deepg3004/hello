"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { updateSettingAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface SettingNumberInputProps {
  storageKey: string;
  label: string;
  description?: string;
  initialValue: string;
  suffix?: string;
}

export function SettingNumberInput({
  storageKey,
  label,
  description,
  initialValue,
  suffix,
}: SettingNumberInputProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  const dirty = value !== initialValue;

  async function save() {
    setSaving(true);
    const r = await updateSettingAction(storageKey, value, false);
    setSaving(false);
    if (!r.ok) {
      toast({ title: "Save failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved" });
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={suffix ? "pr-12" : ""}
          />
          {suffix && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
              {suffix}
            </span>
          )}
        </div>
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}
