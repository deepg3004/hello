"use client";

import { useMemo, useState } from "react";
import { Mail, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

export interface GalleryItem {
  key: string;
  label: string;
  audience: string;
  live: boolean;
  description: string;
  subject: string;
  html: string;
}

const AUDIENCE_ORDER = ["Seller", "KYC", "Billing", "Buyer"];

export function EmailTemplateGallery({ items }: { items: GalleryItem[] }) {
  const [activeKey, setActiveKey] = useState(items[0]?.key ?? "");
  const active = items.find((i) => i.key === activeKey) ?? items[0];

  const grouped = useMemo(() => {
    const m = new Map<string, GalleryItem[]>();
    for (const it of items) {
      if (!m.has(it.audience)) m.set(it.audience, []);
      m.get(it.audience)!.push(it);
    }
    return AUDIENCE_ORDER.filter((a) => m.has(a)).map((a) => ({
      audience: a,
      items: m.get(a)!,
    }));
  }, [items]);

  function openInTab(html: string) {
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  if (!active) return null;

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      {/* ── Left: template list ─────────────────────────────────────── */}
      <div className="space-y-4">
        {grouped.map((g) => (
          <div key={g.audience}>
            <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.audience}
            </p>
            <div className="space-y-1">
              {g.items.map((it) => (
                <button
                  key={it.key}
                  onClick={() => setActiveKey(it.key)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
                    it.key === active.key
                      ? "border-primary/40 bg-primary/5 font-medium text-foreground"
                      : "border-transparent hover:border-border hover:bg-muted/50 text-muted-foreground",
                  )}
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{it.label}</span>
                  {!it.live && (
                    <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700">
                      sample
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Right: preview ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-sora text-base font-semibold tracking-tight">
                {active.label}
              </h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {active.audience}
              </span>
              {active.live ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  Live
                </span>
              ) : (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                  Sample only
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {active.description}
            </p>
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Subject:&nbsp;</span>
              <span className="font-medium">{active.subject}</span>
            </p>
          </div>
          <button
            onClick={() => openInTab(active.html)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in new tab
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-[#f1f1f4]">
          <iframe
            key={active.key}
            title={`Preview: ${active.label}`}
            srcDoc={active.html}
            sandbox=""
            className="h-[640px] w-full border-0 bg-[#f1f1f4]"
          />
        </div>
      </div>
    </div>
  );
}
