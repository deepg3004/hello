"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Save,
  X,
} from "lucide-react";

import { revealCredentialAction, updateSettingAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

const REVEAL_WINDOW_MS = 10_000;

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
  const [revealRemainingMs, setRevealRemainingMs] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"reveal" | "save" | null>(null);
  const remaskTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto re-mask after REVEAL_WINDOW_MS. Cleanup on unmount + manual hide so
  // we don't leak timers between renders.
  useEffect(() => {
    if (revealed === null) {
      if (remaskTimerRef.current) clearTimeout(remaskTimerRef.current);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      setRevealRemainingMs(0);
      return;
    }
    setRevealRemainingMs(REVEAL_WINDOW_MS);
    remaskTimerRef.current = setTimeout(() => {
      setRevealed(null);
    }, REVEAL_WINDOW_MS);
    const start = Date.now();
    tickTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, REVEAL_WINDOW_MS - (Date.now() - start));
      setRevealRemainingMs(remaining);
    }, 200);
    return () => {
      if (remaskTimerRef.current) clearTimeout(remaskTimerRef.current);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    };
  }, [revealed]);

  async function reveal() {
    setBusy("reveal");
    const r = await revealCredentialAction(storageKey);
    setBusy(null);
    if (!r.ok) {
      toast({
        title: "Couldn't reveal",
        description: r.message,
        variant: "destructive",
      });
      return;
    }
    setRevealed(r.value ?? "");
  }

  async function save() {
    setBusy("save");
    const r = await updateSettingAction(storageKey, draft, encrypted);
    setBusy(null);
    if (!r.ok) {
      toast({
        title: "Save failed",
        description: r.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Saved" });
    setEditing(false);
    setDraft("");
    setRevealed(null);
    router.refresh();
  }

  // Status pill text + tone
  const statusPill = empty ? (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      Not set
    </span>
  ) : encrypted ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
      <Check className="h-2.5 w-2.5" />
      Encrypted
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
      Plain
    </span>
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition hover:border-primary/30 hover:shadow-sm md:flex-row md:items-center">
      {/* ── Left: lock icon + label + description ─────────────────── */}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"
        >
          <KeyRound className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-sora text-sm font-semibold text-foreground">
              {label}
            </p>
            {statusPill}
          </div>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          )}
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {storageKey}
          </p>
        </div>
      </div>

      {/* ── Right: value + actions ────────────────────────────────── */}
      <div className="flex w-full items-center gap-2 md:w-auto md:min-w-[420px]">
        {editing ? (
          <>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="New value"
              className="flex-1 font-mono text-xs"
              autoFocus
            />
            <Button
              size="sm"
              onClick={save}
              disabled={busy === "save" || !draft.trim()}
            >
              {busy === "save" ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1 h-3.5 w-3.5" />
              )}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setDraft("");
              }}
              aria-label="Cancel edit"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <code
              className={cn(
                "flex-1 truncate rounded-md bg-muted/40 px-2.5 py-1.5 font-mono text-xs",
                empty
                  ? "text-muted-foreground/60"
                  : revealed
                    ? "text-foreground"
                    : "tracking-wider text-muted-foreground",
              )}
              title={revealed ?? undefined}
            >
              {empty ? "—" : revealed ?? masked}
            </code>
            {!empty && (
              <Button
                size="sm"
                variant="outline"
                onClick={
                  revealed ? () => setRevealed(null) : reveal
                }
                disabled={busy === "reveal"}
                className={cn(
                  "gap-1",
                  revealed && "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-700",
                )}
                title={
                  revealed
                    ? `Re-masks in ${Math.ceil(revealRemainingMs / 1000)}s — click to hide now`
                    : "Reveal for 10 seconds"
                }
              >
                {busy === "reveal" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : revealed ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    <span className="font-mono text-[10px]">
                      {Math.ceil(revealRemainingMs / 1000)}s
                    </span>
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    <span>Reveal</span>
                  </>
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(true);
                setRevealed(null);
              }}
              aria-label="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
