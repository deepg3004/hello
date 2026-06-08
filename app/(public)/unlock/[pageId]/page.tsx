// /unlock/[pageId]?t=<token> — the private page that reveals a Lock Content
// page's gated body + links AFTER payment. Authorised by an HMAC content token
// (signed on the order page / buyer portal) bound to a paid order for this page.
// Server-only read: the locked content never ships to an unpaid visitor.

import Link from "next/link";
import { Lock, ExternalLink } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyContentToken } from "@/lib/content-token";

export const metadata = { title: "Your unlocked content" };
export const dynamic = "force-dynamic";

function Denied({ reason }: { reason: string }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <Lock className="h-10 w-10 text-muted-foreground" />
      <h1 className="mt-4 font-sora text-xl font-semibold">Content locked</h1>
      <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
      <Link
        href="/account"
        className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Go to your purchases
      </Link>
    </main>
  );
}

interface LinkItem {
  label?: string;
  url?: string;
  note?: string;
}

export default async function UnlockPage({
  params,
  searchParams,
}: {
  params: { pageId: string };
  searchParams: { t?: string };
}) {
  const token = searchParams.t;
  const payload = token ? verifyContentToken(token) : null;
  if (!payload || payload.page_id !== params.pageId) {
    return (
      <Denied reason="This unlock link is invalid or has expired. Sign in to your purchases to get a fresh link." />
    );
  }

  const admin = createAdminClient();

  // The token is signed by us, but re-verify the order is genuinely paid and
  // belongs to this page + buyer — defence in depth against a leaked/edited link.
  const { data: order } = await admin
    .from("orders")
    .select("id, page_id, buyer_email, status")
    .eq("id", payload.order_id)
    .maybeSingle();
  if (
    !order ||
    order.page_id !== params.pageId ||
    !["paid", "partially_refunded"].includes(order.status)
  ) {
    return <Denied reason="We couldn't confirm a completed payment for this content." />;
  }

  const { data: page } = await admin
    .from("pages")
    .select("title, template_id, page_config")
    .eq("id", params.pageId)
    .maybeSingle();
  if (!page || page.template_id !== "lock-content") {
    return <Denied reason="This page is no longer available." />;
  }

  const cfg = (page.page_config ?? {}) as Record<string, unknown>;
  const intro = typeof cfg.locked_intro === "string" ? cfg.locked_intro : "";
  const body = typeof cfg.locked_body === "string" ? cfg.locked_body : "";
  const links = (Array.isArray(cfg.locked_links) ? cfg.locked_links : []) as LinkItem[];

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 md:py-16">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">
        <Lock className="h-3 w-3" /> Unlocked
      </div>
      <h1 className="font-sora text-2xl font-bold tracking-tight md:text-3xl">
        {page.title || "Your content"}
      </h1>

      {intro && (
        <p className="mt-4 whitespace-pre-wrap text-muted-foreground">{intro}</p>
      )}

      {body && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="whitespace-pre-wrap leading-relaxed text-foreground">
            {body}
          </p>
        </div>
      )}

      {links.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your links &amp; downloads
          </h2>
          {links
            .filter((l) => l.url)
            .map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-sm transition hover:border-primary hover:bg-primary/5"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">
                    {l.label || l.url}
                  </span>
                  {l.note && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {l.note}
                    </span>
                  )}
                </span>
                <ExternalLink className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
            ))}
        </section>
      )}

      {!body && links.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          The seller hasn&apos;t added the content yet. Check back soon.
        </p>
      )}

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Bookmark this page, or find it any time under{" "}
        <Link href="/account" className="underline">
          your purchases
        </Link>
        .
      </p>
    </main>
  );
}
