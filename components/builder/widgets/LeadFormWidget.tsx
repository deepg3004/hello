"use client";

// Lead / Contact form widget. Submits to /api/builder/leads with the siteId
// (from BuilderContext) — the server resolves the site owner's email and sends
// the lead, so no email address is exposed client-side (no open relay). In the
// editor preview, submit is disabled (no real lead while editing).

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

import { useBuilderContext } from "@/components/builder/BuilderContext";

const s = (v: unknown, fb = ""): string => (typeof v === "string" ? v : fb);

export function LeadFormWidget({ content }: { content: Record<string, unknown> }) {
  const { siteId, preview } = useBuilderContext();
  const mode = s(content.fields, "full");
  const showPhone = mode === "name_email_phone" || mode === "full";
  const showMessage = mode === "full";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (preview) {
      setDone(true);
      return;
    }
    if (!siteId) {
      setError("Form isn't connected yet.");
      return;
    }
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter your name and a valid email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/builder/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId, name, email, phone, message }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't submit");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-current/10 bg-current/5 p-6 text-center">
        <p className="text-lg font-semibold">Thank you! 🎉</p>
        <p className="mt-1 text-sm opacity-70">We&apos;ll be in touch shortly.</p>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-current/20 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-current/50";

  return (
    <form onSubmit={submit} className="rounded-2xl border border-current/10 bg-current/5 p-6">
      {s(content.title) && <p className="mb-3 text-lg font-semibold">{s(content.title)}</p>}
      <div className="space-y-2.5">
        <input className={inputCls} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <input className={inputCls} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        {showPhone && (
          <input className={inputCls} type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        )}
        {showMessage && (
          <textarea className={inputCls} placeholder="Message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        )}
      </div>
      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-current px-5 py-3 text-sm font-semibold text-[var(--btn-fg,#fff)] transition hover:opacity-90"
        style={{ color: "#fff", background: "#4f46e5" }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {s(content.button, "Submit")}
      </button>
    </form>
  );
}
