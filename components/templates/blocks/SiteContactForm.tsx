"use client";

import { useState } from "react";

/** Contact form that emails the seller (resolved server-side from the host). */
export function SiteContactForm({
  ctaLabel,
  accent,
}: {
  ctaLabel: string;
  accent: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/site/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: typeof window !== "undefined" ? window.location.host : "",
          name,
          email,
          message,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Couldn't send. Try again.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Network error. Try again.");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <p className="rounded-xl bg-white/90 p-6 text-center text-zinc-900">
        ✅ Thanks! Your message has been sent.
      </p>
    );
  }

  const field =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:ring-2";
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white/95 p-6 shadow-xl">
      <input
        className={field}
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        className={field}
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <textarea
        className={field}
        placeholder="Your message"
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white shadow disabled:opacity-60"
        style={{ backgroundColor: accent }}
      >
        {busy ? "Sending…" : ctaLabel || "Send message"}
      </button>
    </form>
  );
}
