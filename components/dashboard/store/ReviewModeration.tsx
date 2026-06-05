"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { setReviewVisibilityAction } from "@/actions/store";

export interface ModerationReview {
  id: string;
  subject_type: "product" | "course";
  subject_label: string;
  rating: number;
  title: string | null;
  body: string | null;
  buyer_name: string | null;
  buyer_email: string;
  status: "published" | "hidden";
  created_at: string;
}

/** Seller-side reviews list with a hide/unhide toggle. */
export function ReviewModeration({ reviews }: { reviews: ModerationReview[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function toggle(r: ModerationReview) {
    setBusy(r.id);
    start(async () => {
      const res = await setReviewVisibilityAction(r.id, r.status === "published");
      setBusy(null);
      if (!res.ok) {
        toast({ variant: "destructive", title: "Couldn't update", description: res.message });
        return;
      }
      toast({ title: r.status === "published" ? "Review hidden" : "Review restored" });
      router.refresh();
    });
  }

  if (reviews.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No reviews yet. They’ll appear here as buyers rate your products and courses.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border rounded-lg border">
      {reviews.map((r) => (
        <div key={r.id} className="flex flex-wrap items-start gap-3 p-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-0.5 text-amber-500">
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                ))}
              </span>
              <Badge variant="outline" className="text-[10px] capitalize">
                {r.subject_type}
              </Badge>
              <span className="truncate text-xs text-muted-foreground">{r.subject_label}</span>
              {r.status === "hidden" && <Badge variant="secondary">Hidden</Badge>}
            </div>
            {r.title && <p className="mt-1 text-sm font-medium">{r.title}</p>}
            {r.body && <p className="text-sm text-muted-foreground">{r.body}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {r.buyer_name ?? r.buyer_email} · {formatDate(r.created_at)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending && busy === r.id}
            onClick={() => toggle(r)}
          >
            {r.status === "published" ? (
              <>
                <EyeOff className="mr-1.5 h-4 w-4" /> Hide
              </>
            ) : (
              <>
                <Eye className="mr-1.5 h-4 w-4" /> Show
              </>
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}
