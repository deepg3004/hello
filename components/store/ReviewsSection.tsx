"use client";

import { useState } from "react";
import { BadgeCheck, Loader2, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { Stars } from "@/components/store/Stars";
import type { ReviewRow, ReviewSummary } from "@/lib/reviews";

export function ReviewsSection({
  subjectType,
  subjectId,
  summary,
  reviews,
  subjectLabel = "product",
}: {
  subjectType: "product" | "course";
  subjectId: string;
  summary: ReviewSummary;
  reviews: ReviewRow[];
  subjectLabel?: string;
}) {
  const { toast } = useToast();
  const [writing, setWriting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");

  async function submit() {
    if (rating < 1) {
      toast({ variant: "destructive", title: "Pick a star rating" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject_type: subjectType,
          subject_id: subjectId,
          rating,
          name: name.trim() || undefined,
          title: title.trim() || undefined,
          body: bodyText.trim() || undefined,
        }),
      });
      const b = (await res.json()) as { ok?: boolean; error?: string; needsLogin?: boolean };
      if (res.status === 401 || b.needsLogin) {
        // Reviewer must be signed into the buyer portal so we can verify the
        // purchase against a proven email.
        toast({
          title: "Please sign in to review",
          description: "Use the email you purchased with — redirecting you to sign in…",
        });
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        setTimeout(() => {
          window.location.href = `/account?next=${next}`;
        }, 1200);
        return;
      }
      if (!res.ok || !b.ok) throw new Error(b.error ?? "Couldn't submit review");
      setDone(true);
      setWriting(false);
      toast({ title: "Thanks for your review!", description: "It’s now live on this page." });
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      toast({ variant: "destructive", title: "Couldn't submit", description: e instanceof Error ? e.message : undefined });
    } finally {
      setSubmitting(false);
    }
  }

  const pct = (n: number) => (summary.count ? Math.round((n / summary.count) * 100) : 0);

  return (
    <section className="sf-border border-t pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="sf-display text-xl font-bold tracking-tight">Ratings & reviews</h2>
        {!writing && !done && (
          <button className="sf-btn-outline px-4 py-2 text-sm font-medium transition hover:opacity-80" onClick={() => setWriting(true)}>
            Write a review
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="mt-5 grid gap-6 sm:grid-cols-[200px_1fr]">
        <div className="sf-card flex flex-col items-center justify-center p-5 text-center">
          <div className="text-4xl font-bold">{summary.average.toFixed(1)}</div>
          <Stars value={summary.average} size={18} className="mt-1" />
          <p className="sf-muted mt-1 text-sm">
            {summary.count} review{summary.count === 1 ? "" : "s"}
          </p>
        </div>
        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((s) => (
            <div key={s} className="flex items-center gap-2 text-sm">
              <span className="sf-muted w-8">{s}★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--sf-border)" }}>
                <div className="h-full bg-amber-400" style={{ width: `${pct(summary.breakdown[s as 1 | 2 | 3 | 4 | 5])}%` }} />
              </div>
              <span className="sf-muted w-9 text-right text-xs">{summary.breakdown[s as 1 | 2 | 3 | 4 | 5]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Write form */}
      {writing && (
        <div className="sf-card mt-6 space-y-3 p-5">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(s)}
                aria-label={`${s} stars`}
              >
                <Star
                  className="h-7 w-7 text-amber-400"
                  fill={(hover || rating) >= s ? "currentColor" : "none"}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Reviews are only accepted from verified buyers. You’ll review as your
            signed-in account (the email you purchased this {subjectLabel} with) —
            we’ll ask you to sign in if you haven’t.
          </p>
          <Input placeholder="Display name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={3} placeholder="Share your experience…" value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
          <div className="flex gap-2">
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit review
            </Button>
            <Button variant="ghost" onClick={() => setWriting(false)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="mt-8 space-y-5">
        {reviews.length === 0 ? (
          <p className="sf-muted text-sm">
            No reviews yet — be the first to review this {subjectLabel}.
          </p>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="sf-border border-b pb-5 last:border-0">
              <div className="flex items-center gap-2">
                <Stars value={r.rating} size={14} />
                {r.verified && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified buyer
                  </span>
                )}
              </div>
              {r.title && <p className="mt-1.5 font-medium">{r.title}</p>}
              {r.body && <p className="sf-muted mt-1 text-sm">{r.body}</p>}
              <p className="sf-muted mt-1.5 text-xs">
                {r.buyer_name ?? "Anonymous"} · {formatDate(r.created_at)}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
