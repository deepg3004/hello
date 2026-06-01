"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { updateSettingAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { ImageInput } from "@/components/ui/ImageInput";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Props {
  storageKey: string;
  label: string;
  description?: string;
  initialValue: string;
}

/** Platform-setting field for an image: paste a URL OR upload, then Save. */
export function SettingImageInput({
  storageKey,
  label,
  description,
  initialValue,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await updateSettingAction(storageKey, value);
    setSaving(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Couldn't save", description: res.message });
      return;
    }
    toast({ title: "Saved" });
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <ImageInput value={value} onChange={setValue} endpoint="/api/learn/upload" />
      <Button onClick={save} disabled={saving || value === initialValue} variant="outline" size="sm">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save logo"}
      </Button>
    </div>
  );
}
