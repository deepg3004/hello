"use client";

import { useState } from "react";
import { Heart, Loader2, Check } from "lucide-react";

import { addToWishlistAction } from "@/actions/buyer-account";
import { useToast } from "@/hooks/use-toast";

/**
 * Floating "Save to wishlist" control on a product page. Saves for the
 * signed-in buyer; if there's no buyer session it nudges them to /account.
 */
export function WishlistButton({ pageId }: { pageId: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (saved) return;
    setBusy(true);
    const r = await addToWishlistAction(pageId);
    setBusy(false);
    if (!r.ok) {
      toast({
        title: "Not saved",
        description: r.message,
        variant: "destructive",
      });
      return;
    }
    setSaved(true);
    toast({ title: "Saved to your wishlist" });
  }

  return (
    <button
      onClick={save}
      disabled={busy}
      aria-label="Save to wishlist"
      className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-4 py-2 text-sm font-medium text-foreground shadow-card backdrop-blur transition hover:bg-muted disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : saved ? (
        <Check className="h-4 w-4 text-emerald-500" />
      ) : (
        <Heart className="h-4 w-4" />
      )}
      {saved ? "Saved" : "Wishlist"}
    </button>
  );
}
