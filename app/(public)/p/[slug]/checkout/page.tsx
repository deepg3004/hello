import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Check, Lock, ShieldCheck, Zap } from "lucide-react";

import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { CheckoutExitGuard } from "@/components/pages/CheckoutExitGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import { tgTheme } from "@/lib/telegram-themes";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Checkout" };

// Always fresh — reflect plan/price/theme edits immediately (no stale cache).
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const inr = (n: number) => formatINR(n * 100);

function formatDuration(days: number | null | undefined): string {
  if (days == null || days === 0) return "Lifetime access";
  if (days % 365 === 0) return `${days / 365} year${days / 365 > 1 ? "s" : ""} access`;
  if (days % 30 === 0) return `${days / 30} month${days / 30 > 1 ? "s" : ""} access`;
  return `${days} day${days > 1 ? "s" : ""} access`;
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { product?: string };
}) {
  const admin = createAdminClient();

  const { data: page } = await admin
    .from("pages")
    .select("id, user_id, title, slug, status, page_config")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!page || page.status !== "published") notFound();

  const productId = searchParams.product ?? "";
  const { data: product } = productId
    ? await admin
        .from("products")
        .select(
          "id, name, description, image_url, price, original_price, currency, subscription_days, display_label, active, page_id",
        )
        .eq("id", productId)
        .maybeSingle()
    : { data: null };

  const cfg = (page.page_config ?? {}) as Record<string, unknown>;
  const groupName = String(cfg.group_name ?? page.title);
  // Match the public page's theme (background + accent).
  const theme = tgTheme(cfg.theme as string | undefined);
  const questions = (Array.isArray(cfg.checkout_questions)
    ? cfg.checkout_questions
    : []) as Array<{ label: string; required: boolean }>;

  // Plan no longer available (e.g. a stale link after the seller edited plans).
  if (!product || !product.active || product.page_id !== page.id) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#1a0733] px-4 text-center text-zinc-100">
        <div>
          <p className="font-sora text-xl font-semibold">This plan is no longer available</p>
          <p className="mt-2 text-sm text-zinc-400">The seller may have updated their plans.</p>
          <Link href={`/p/${page.slug}`} className="mt-4 inline-block rounded-lg bg-[#0088cc] px-4 py-2 text-sm font-semibold text-white">
            See current plans
          </Link>
        </div>
      </main>
    );
  }

  const label = product.display_label || product.name;
  const orig = Number(product.original_price ?? 0);
  const price = Number(product.price);
  const off = orig > price ? Math.round((1 - price / orig) * 100) : 0;
  const features = String(cfg.description ?? "")
    .split(/\n+/)
    .map((s) => s.replace(/^[-•✅⭐📌\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-zinc-900">
      <CheckoutExitGuard backHref={`/p/${page.slug}`} amountLabel={inr(price)} />
      {/* ── Top bar — brand + secure badge (Magic-Checkout style) ─────── */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: theme.accent }}
            >
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.image_url} alt={groupName} className="h-full w-full object-cover" />
              ) : (
                groupName.slice(0, 2).toUpperCase()
              )}
            </span>
            <span className="truncate font-sora text-sm font-semibold">{groupName}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            <Lock className="h-3 w-3" /> Secure checkout
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-6 pb-28 md:py-10">
        <Link
          href={`/p/${page.slug}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to plans
        </Link>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
          {/* ── Payment form (left on desktop, below summary on mobile) ── */}
          <div className="order-2 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm md:p-6 lg:order-1">
            <h2 className="font-sora text-base font-bold">Contact &amp; delivery</h2>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              We&apos;ll send your access here the moment payment succeeds.
            </p>
            <div className="mt-4">
              <CheckoutForm
                pageId={page.id}
                productId={product.id}
                productName={product.name}
                productDescription={product.description}
                productImage={product.image_url}
                price={price}
                currency={product.currency}
                primaryColor={theme.accent}
                questions={questions}
                stickyPay
              />
            </div>
          </div>

          {/* ── Order summary (right on desktop, top on mobile, sticky) ── */}
          <aside className="order-1 h-fit lg:order-2 lg:sticky lg:top-20">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                Order summary
              </h2>
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: theme.accent }}
                >
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image_url} alt={groupName} className="h-full w-full object-cover" />
                  ) : (
                    groupName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{groupName}</div>
                  <div className="text-xs text-zinc-500">
                    {label} · {formatDuration(product.subscription_days)}
                  </div>
                </div>
              </div>

              {/* Price breakdown */}
              <dl className="mt-5 space-y-2 border-t border-zinc-100 pt-4 text-sm">
                {orig > price && (
                  <>
                    <div className="flex items-center justify-between text-zinc-500">
                      <dt>Subtotal</dt>
                      <dd className="line-through">{inr(orig)}</dd>
                    </div>
                    <div className="flex items-center justify-between text-emerald-600">
                      <dt className="flex items-center gap-1">
                        <BadgeCheck className="h-3.5 w-3.5" /> Discount ({off}% off)
                      </dt>
                      <dd>− {inr(orig - price)}</dd>
                    </div>
                  </>
                )}
                <div className="flex items-end justify-between border-t border-zinc-100 pt-3">
                  <dt className="font-semibold">Total</dt>
                  <dd className="font-sora text-2xl font-bold">{inr(price)}</dd>
                </div>
              </dl>

              {features.length > 0 && (
                <ul className="mt-5 space-y-2 border-t border-zinc-100 pt-4">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={3} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Trust badges */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-medium text-zinc-600">
              <TrustBadge icon={ShieldCheck} label="100% Secure" />
              <TrustBadge icon={Zap} label="Instant access" />
              <TrustBadge icon={Lock} label="SSL encrypted" />
              <TrustBadge icon={BadgeCheck} label="Razorpay verified" />
            </div>
            <p className="mt-3 text-center text-[11px] text-zinc-400">
              🔒 Payments secured by{" "}
              <span className="font-semibold text-zinc-600">Razorpay</span>
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

function TrustBadge({
  icon: Icon,
  label,
}: {
  icon: typeof ShieldCheck;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-2">
      <Icon className="h-3.5 w-3.5 text-emerald-600" />
      {label}
    </span>
  );
}
