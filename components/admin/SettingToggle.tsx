"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateSettingAction } from "@/actions/admin";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface Props {
  storageKey: string;
  label: string;
  description?: string;
  initialValue: string;
  /** Show an amber confirm dialog before flipping. */
  destructive?: boolean;
}

export function SettingToggle({
  storageKey,
  label,
  description,
  initialValue,
  destructive,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [on, setOn] = useState(initialValue === "true");
  const [saving, setSaving] = useState(false);

  async function flip(next: boolean) {
    if (destructive && next) {
      if (
        !confirm(
          `${label}\n\nThis will affect every user immediately. Proceed?`,
        )
      ) {
        return;
      }
    }
    setSaving(true);
    const res = await updateSettingAction(storageKey, next ? "true" : "false");
    setSaving(false);
    if (!res.ok) {
      toast({
        variant: "destructive",
        title: "Couldn't save",
        description: res.message,
      });
      return;
    }
    setOn(next);
    toast({ title: `${label}: ${next ? "on" : "off"}` });
    router.refresh();
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch checked={on} onCheckedChange={flip} disabled={saving} />
    </div>
  );
}
