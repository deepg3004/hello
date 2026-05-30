import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";
import { OtoCheckoutButton } from "@/components/pages/OtoCheckoutButton";
import { OTO_COOKIE_NAME, verifyOtoToken } from "@/lib/oto-token";
import { OTO_DEFAULTS } from "@/lib/upsells";

export const metadata = { title: "Special offer" };

interface OtoConfigShape {
  enabled?: boolean;
  product_id?: string;
  price?: number;
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

  // Token missing or expired → bounce to the order confirmation if we can.
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

  const cfg = ((page.page_config as { oto_config?: OtoConfigShape } | null) ?? {}).oto_config;
  if (!cfg?.enabled || !cfg.product_id) {
    redirect(`/order/${payload.order_id}?status=success`);
  }

  const { data: product } = await admin
    .from("products")
    .select("name, price, currency, image_url, description")
    .eq("id", cfg.product_id)
    .single();
  if (!product) notFound();

  const price = Number(cfg.price ?? product.price);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-12">
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-8 shadow-xl">
        <p className="mb-2 inline-block rounded-full bg-amber-400/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-900">
          One-time offer
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-amber-950 sm:text-4xl">
          {cfg.headline ?? OTO_DEFAULTS.headline}
        </h1>

        {cfg.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cfg.image_url}
            alt={product.name}
            className="mt-6 aspect-video w-full rounded-lg border border-amber-200 object-cover"
          />
        )}

        <p className="mt-6 whitespace-pre-wrap text-amber-900">
          {cfg.description ?? OTO_DEFAULTS.description}
        </p>

        <div className="mt-6 rounded-md border border-amber-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-amber-950">{product.name}</span>
            <span className="font-mono text-lg font-semibold">
              ₹{price.toLocaleString("en-IN")} {product.currency ?? "INR"}
            </span>
          </div>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-xs text-amber-800">{product.description}</p>
          )}
        </div>

        <div className="mt-6">
          <OtoCheckoutButton
            ctaText={cfg.cta_text ?? OTO_DEFAULTS.cta_text}
            declineText={cfg.decline_text ?? OTO_DEFAULTS.decline_text}
          />
        </div>
        <p className="mt-4 text-center text-xs text-amber-800">
          <Link href={`/order/${payload.order_id}?status=success`} className="underline">
            No thanks — take me to my order
          </Link>
        </p>
      </div>
    </main>
  );
}
