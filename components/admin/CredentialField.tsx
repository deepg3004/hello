"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Pencil, Save } from "lucide-react";

import { revealCredentialAction, updateSettingAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface CredentialFieldProps {
  /** Storage key in platform_settings. */
  storageKey: string;
  label: string;
  description?: string;
  /** Masked text shown by default. */
  masked: string;
  /** Whether the stored value is encrypted at rest. */
  encrypted: boolean;
  /** True if the value isn't set at all. */
  empty: boolean;
}

export function CredentialField({
  storageKey,
  label,
  description,
  masked,
  encrypted,
  empty,
}: CredentialFieldProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"reveal" | "save" | null>(null);

  async function reveal() {
    setBusy("reveal");
    const r = await revealCredentialAction(storageKey);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't reveal", description: r.message, variant: "destructive" });
      return;
    }
    setRevealed(r.value ?? "");
  }

  async function save() {
    setBusy("save");
    const r = await updateSettingAction(storageKey, draft, encrypted);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Save failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved" });
    setEditing(false);
    setDraft("");
    setRevealed(null);
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider " +
            (empty
              ? "bg-muted text-muted-foreground"
              : encrypted
                ? "bg-emerald-100 text-emerald-800"
                : "bg-zinc-200 text-zinc-700")
          }
        >
          {empty ? "Not set" : encrypted ? "Encrypted" : "Plain"}
        </span>
      </div>

      {editing ? (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New value"
            className="font-mono text-xs"
          />
          <Button size="sm" onClick={save} disabled={busy === "save"}>
            {busy === "save" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            <Save className="mr-1 h-3.5 w-3.5" />
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setDraft("");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-background px-2 py-1.5 font-mono text-xs">
            {empty ? "—" : revealed ?? masked}
          </code>
          {!empty && (
            <Button
              size="sm"
              variant="outline"
              onClick={revealed ? () => setRevealed(null) : reveal}
              disabled={busy === "reveal"}
            >
              {busy === "reveal" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : revealed ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
