"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/utils";

export interface PublicPlan {
  id: string;
  label: string;
  price: number; // rupees
  subscription_days: number | null;
}

export function PublicPageCard({
  url,
  plans,
}: {
  url: string;
  plans: PublicPlan[];
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions) — no-op; the link
      // is still visible and openable.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Public subscription page</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 text-sm">
            {url}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            {copied ? (
              <Check className="mr-1.5 h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="mr-1.5 h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button asChild size="sm">
            <Link href={url} target="_blank">
              <ExternalLink className="mr-1.5 h-4 w-4" /> Open
            </Link>
          </Button>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Plans on this page
          </p>
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active plans yet. Add pricing tiers from the page editor.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {plans.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{p.label}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">
                      {p.subscription_days == null || p.subscription_days === 0
                        ? "Lifetime"
                        : `${p.subscription_days} days`}
                    </Badge>
                    <span className="font-semibold">{formatINR(p.price * 100)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
