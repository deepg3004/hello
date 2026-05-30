import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Clock, Sparkles, Zap } from "lucide-react";

import { OtoCheckoutButton } from "@/components/pages/OtoCheckoutButton";
import { OtoCountdownBar } from "@/components/pages/OtoCountdownBar";
import { OTO_COOKIE_NAME, verifyOtoToken } from "@/lib/oto-token";
import { OTO_DEFAULTS } from "@/lib/upsells";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Special offer" };

interface OtoConfigShape {
  enabled?: boolean;
  product_id?: string;
  price?: number;
  /** Optional original/list price — drives the strikethrough + "Save X%" pill. */
  original_price?: number;
  headline?: string;
  description?: string;
  image_url?: string;
  cta_text?: string;
  decline_text?: string;
}

export default async function OtoPage({ params }: { params: { slug: string } }) {
  const jar = cookies();
  const token = jar.get(OTO_COOKIE_NAME)?.value;
  const payload = token ? verifyOtoToken(token) : null;

  // Token missing or expired → just send the buyer home; their original
  // order isn't reachable from this state.
  if (!payload || payload.slug !== params.slug) {
    redirect("/");
  }

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select("id, slug, status, page_config")
    .eq("id", payload.page_id)
    .single();
  if (!page || page.status !== "published") notFound();

  const cfg = ((page.page_config as { oto_config?: OtoConfigShape } | null) ?? {})
    .oto_config;
  if (!cfg?.enabled || !cfg.product_id) {
    redirect(`/order/${payload.order_id}?status=success`);
  }

  const { data: product } = await admin
    .from("products")
    .select("name, price, currency, image_url, description")
    .eq("id", cfg.product_id)
    .single();
  if (!product) notFound();

  // OTO price + crossed-out original. If seller didn't set explicit
  // original_price, fall back to the product's regular price (only when
  // it's actually higher than the OTO price — otherwise hide the strike).
  const otoPrice = Number(cfg.price ?? product.price);
  const explicitOriginal = cfg.original_price ?? 0;
  const productPrice = Number(product.price ?? 0);
  const originalPrice =
    explicitOriginal > otoPrice
      ? explicitOriginal
      : productPrice > otoPrice
        ? productPrice
        : 0;
  const hasDiscount = originalPrice > otoPrice;
  const savePct = hasDiscount
    ? Math.round(((originalPrice - otoPrice) / originalPrice) * 100)
    : 0;

  const headline = cfg.headline ?? OTO_DEFAULTS.headline;
  const description = cfg.description ?? OTO_DEFAULTS.description;
  const ctaText = cfg.cta_text ?? OTO_DEFAULTS.cta_text;
  const declineText = cfg.decline_text ?? OTO_DEFAULTS.decline_text;

  return (
    <main className="min-h-screen bg-zinc-50 pb-24 md:pb-12">
      {/* ── Full-width amber banner ─────────────────────────────────── */}
      <div className="border-b border-amber-300 bg-amber-400 px-4 py-2.5 text-center text-sm font-bold text-amber-950">
        <span className="inline-flex items-center gap-1.5">
          <Zap className="h-4 w-4" />
          Special One-Time Offer — only available right now
        </span>
      </div>

      {/* ── Hero copy + offer card ──────────────────────────────────── */}
      <div className="mx-auto max-w-2xl px-4 pt-10 md:pt-14">
        {/* Eyebrow */}
        <p className="text-center text-[11px] font-bold uppercase tracking-widest text-amber-700">
          <Sparkles className="mr-1 inline h-3 w-3" />
          One-time deal
        </p>

        <h1 className="mt-3 text-center font-sora text-[26px] font-bold leading-tight tracking-tight text-zinc-900 sm:text-[28px]">
          Wait! Your order is confirmed — but here&apos;s something extra:
        </h1>

        <p className="mt-4 text-center font-sora text-[32px] font-bold leading-tight text-zinc-900 sm:text-4xl">
          <span className="relative inline-block">
            {headline}
            <span
              aria-hidden
              className="absolute -bottom-1 left-0 right-0 h-2 -z-10 rounded-full bg-amber-300/60"
            />
          </span>
        </p>

        {/* ── Offer card ─────────────────────────────────────────── */}
        <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-zinc-200">
          {/* Product visual */}
          <div className="aspect-[16/9] w-full bg-zinc-100">
            {cfg.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={cfg.image_url}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                aria-hidden
                className="flex h-full w-full items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(249,115,22,0.12) 60%, rgba(244,245,248,1) 100%)",
                }}
              >
                <span className="font-sora text-2xl font-semibold text-amber-500/60">
                  {product.name}
                </span>
              </div>
            )}
          </div>

          <div className="p-6 md:p-8">
            <h2 className="font-sora text-xl font-bold tracking-tight text-zinc-900">
              {product.name}
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
              {description}
            </p>

            {/* Price row */}
            <div className="mt-5 flex flex-wrap items-baseline gap-3 border-t border-zinc-100 pt-5">
              {hasDiscount && (
                <span className="text-base text-zinc-400 line-through">
                  ₹{originalPrice.toLocaleString("en-IN")}
                </span>
              )}
              <span className="font-sora text-4xl font-bold tracking-tight text-emerald-600">
                ₹{otoPrice.toLocaleString("en-IN")}
              </span>
              <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                {product.currency ?? "INR"} · one-time
              </span>
              {hasDiscount && (
                <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  Save {savePct}%
                </span>
              )}
            </div>

            {/* Desktop countdown — matches the mobile sticky bar */}
            <div className="mt-5 hidden md:block">
              <DesktopOfferCountdown />
            </div>

            {/* Accept CTA */}
            <div className="mt-5">
              <OtoCheckoutButton
                ctaText={ctaText}
                declineText={declineText}
              />
            </div>

            {/* Decline link */}
            <p className="mt-3 text-center">
              <Link
                href={`/order/${payload.order_id}?status=success`}
                className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline"
              >
                No thanks, I&apos;ll pass on this deal
              </Link>
            </p>
          </div>
        </div>

        {/* Trust line */}
        <p className="mt-5 text-center text-[11px] text-zinc-500">
          🔒 Secure payment · Charged to the same card · No re-entry needed
        </p>
      </div>

      {/* Sticky mobile-only countdown bar */}
      <OtoCountdownBar />
    </main>
  );
}

/**
 * Tiny inline desktop-only countdown — matches the mobile sticky bar.
 * Kept inline so it ships with the page without an extra component file.
 */
function DesktopOfferCountdown() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
      <p className="flex items-center justify-center gap-1.5 text-xs font-medium">
        <Clock className="h-3.5 w-3.5" />
        This offer expires after you leave this page
        <ArrowRight className="h-3 w-3" />
      </p>
    </div>
  );
}
