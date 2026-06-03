"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Monitor, Smartphone } from "lucide-react";

import { Label } from "@/components/ui/label";
import { encodeValues } from "@/lib/templates/utils";
import { cn } from "@/lib/utils";

/**
 * Persistent live preview shown beside every editor step. Debounces the values
 * into the /preview iframe URL and offers a desktop / mobile frame toggle so
 * the seller can check both layouts while editing.
 */
export function LivePreview({
  templateId,
  values,
  title,
}: {
  templateId: string;
  values: Record<string, unknown>;
  title: string;
}) {
  const [url, setUrl] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const payload = { __title: title, ...values };
      // Preferred: POST the values, load the iframe by a short token so the URL
      // stays tiny (a large page_config in the query string blows past nginx's
      // header buffer → Cloudflare 520). Fall back to inline encoding only if
      // the token request fails.
      try {
        const res = await fetch("/api/preview-token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ values: payload }),
        });
        const json = (await res.json()) as { k?: string };
        if (!cancelled && json.k) {
          setUrl(`/preview/${templateId}?k=${json.k}`);
          return;
        }
      } catch {
        /* fall through to inline encoding */
      }
      if (!cancelled) {
        setUrl(`/preview/${templateId}?v=${encodeValues(payload)}`);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [templateId, values, title]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between">
        <Label className="text-sm font-medium">Live preview</Label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            aria-label="Desktop preview"
            className={cn(
              "rounded p-1.5 transition-colors",
              device === "desktop"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Monitor className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            aria-label="Mobile preview"
            className={cn(
              "rounded p-1.5 transition-colors",
              device === "mobile"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Smartphone className="h-4 w-4" />
          </button>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Open <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
      <div
        className={cn(
          "mx-auto flex min-h-[60vh] w-full flex-1 overflow-hidden rounded-xl border bg-muted/30 transition-all duration-300 lg:min-h-0",
          device === "mobile" ? "max-w-[390px]" : "max-w-full",
        )}
      >
        {url ? (
          <iframe
            key={templateId}
            src={url}
            className="h-full w-full bg-white"
            title="Live preview"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading preview
          </div>
        )}
      </div>
    </div>
  );
}
