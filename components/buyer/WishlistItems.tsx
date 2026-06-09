"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Loader2, ShoppingBag, Trash2 } from "lucide-react";

import { removeFromWishlistAction } from "@/actions/buyer-account";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/hooks/use-toast";

export interface WishlistItem {
  id: string;
  title: string;
  slug: string | null;
  available: boolean;
}

export function WishlistItems({ items }: { items: WishlistItem[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="Your wishlist is empty"
        description="Tap “Wishlist” on any product page to save it for later."
      />
    );
  }

  async function remove(id: string) {
    setBusy(id);
    const r = await removeFromWishlistAction(id);
    setBusy(null);
    if (!r.ok) {
      toast({ title: "Couldn't remove", description: r.message, variant: "destructive" });
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {items.map((it) => (
        <Card key={it.id}>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 truncate font-medium">{it.title}</p>
            <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
              {it.available && it.slug ? (
                <Button asChild size="sm">
                  <Link href={`/p/${it.slug}`}>
                    <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
                    Buy now
                  </Link>
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">No longer available</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(it.id)}
                disabled={busy === it.id}
              >
                {busy === it.id ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                Remove
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
