"use client";

import { useState } from "react";
import { Lock, Loader2, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PagePasswordGate({ pageId, title }: { pageId: string; title?: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!password.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/builder/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pageId, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Wrong password.");
        setBusy(false);
        return;
      }
      // Reload — the server now sees the unlock cookie and renders the page.
      window.location.reload();
    } catch {
      setError("Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-5 w-5" />
        </span>
        <h1 className="font-sora text-lg font-semibold">{title || "This page is locked"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter the password to continue.</p>
        <div className="mt-5 space-y-2 text-left">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Password"
            autoFocus
          />
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Unlock
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </main>
  );
}
