"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { updateSettingAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Props {
  storageKey: string;
  label: string;
  description?: string;
  initialValue: string;
  /** Render a multi-line textarea instead of a one-line input. */
  multiline?: boolean;
  placeholder?: string;
}

export function SettingTextInput({
  storageKey,
  label,
  description,
  initialValue,
  multiline,
  placeholder,
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
      toast({
        variant: "destructive",
        title: "Couldn't save",
        description: res.message,
      });
      return;
    }
    toast({ title: "Saved" });
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <div className="flex gap-2">
        {multiline ? (
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="font-mono text-xs"
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
          />
        )}
        <Button
          onClick={save}
          disabled={saving || value === initialValue}
          variant="outline"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}
