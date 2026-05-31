import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Lock } from "lucide-react";

import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { createAdminClient } from "@/lib/supabase/admin";
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
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -10%, #4c1d95 0%, #2e1065 45%, #1a0733 100%)",
      }}
    >
      <div className="mx-auto max-w-4xl px-4 py-10 md:py-14">
        <Link href={`/p/${page.slug}`} className="inline-flex items-center gap-1 text-sm text-zinc-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to plans
        </Link>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {/* Order summary */}
          <div className="rounded-2xl border border-white/10 bg-[#15151f] p-6 text-zinc-100 shadow-2xl md:p-8">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Order summary</h2>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0088cc] text-sm font-semibold text-white">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt={groupName} className="h-full w-full object-cover" />
                ) : (
                  groupName.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-white">{groupName}</div>
                <div className="text-xs text-zinc-400">{label} · {formatDuration(product.subscription_days)}</div>
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between border-y border-white/10 py-4">
              <div className="flex items-center gap-2">
                <span className="font-sora text-3xl font-bold text-white">{inr(price)}</span>
                {orig > price && <span className="text-sm text-zinc-500 line-through">{inr(orig)}</span>}
              </div>
              {off > 0 && (
                <span className="rounded-md bg-emerald-500/20 px-2 py-1 text-xs font-bold text-emerald-300">
                  {off}% OFF · Save {inr(orig - price)}
                </span>
              )}
            </div>

            {features.length > 0 && (
              <ul className="mt-5 space-y-2">
                {features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" strokeWidth={3} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-6 flex items-center gap-1.5 text-[11px] text-zinc-500">
              <Lock className="h-3 w-3" /> Secure payment · Razorpay · Invite link sent instantly after payment
            </p>
          </div>

          {/* Payment form */}
          <div className="rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl md:p-7">
            <h2 className="mb-4 font-sora text-lg font-bold">Complete your purchase</h2>
            <CheckoutForm
              pageId={page.id}
              productId={product.id}
              productName={product.name}
              productDescription={product.description}
              productImage={product.image_url}
              price={price}
              currency={product.currency}
              primaryColor="#0088cc"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
