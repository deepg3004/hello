// Seller "home" — rendered when a buyer hits the root of a seller's
// subdomain (rahul.invoxai.io) or custom domain (pages.rahul.com).
//
// We surface every published page the seller has — minimal directory so
// they always have something to land on.

import { notFound } from "next/navigation";
import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";

interface Props {
  params: { username: string };
}

interface PageRow {
  slug: string;
  title: string;
  meta_description: string | null;
  thumbnail_url: string | null;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("full_name, legal_business_name")
    .eq("subdomain", params.username)
    .maybeSingle();
  const title =
    profile?.legal_business_name ??
    profile?.full_name ??
    params.username;
  return { title };
}

export default async function SellerHome({ params }: Props) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, full_name, legal_business_name, avatar_url")
    .eq("subdomain", params.username)
    .maybeSingle();
  if (!profile?.id) notFound();

  const { data: pages } = await admin
    .from("pages")
    .select("slug, title, meta_description, thumbnail_url")
    .eq("user_id", profile.id)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  const sellerName =
    profile.legal_business_name ?? profile.full_name ?? params.username;
  const list = (pages ?? []) as PageRow[];

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10 flex items-center gap-4">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={sellerName}
            className="h-14 w-14 rounded-full border object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-base font-semibold text-zinc-700">
            {(sellerName?.[0] ?? "?").toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-sora font-semibold tracking-tight">
            {sellerName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Published pages from {sellerName}.
          </p>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-muted-foreground">
          No pages live yet. Check back soon.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((p) => (
            <Link
              key={p.slug}
              href={`/${p.slug}`}
              className="group block overflow-hidden rounded-lg border bg-white shadow-sm transition hover:border-primary hover:shadow"
            >
              {p.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.thumbnail_url}
                  alt={p.title}
                  className="aspect-[16/9] w-full object-cover"
                />
              ) : (
                <div className="aspect-[16/9] w-full bg-zinc-100" />
              )}
              <div className="p-4">
                <h3 className="text-base font-sora font-semibold tracking-tight group-hover:text-primary">
                  {p.title}
                </h3>
                {p.meta_description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {p.meta_description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
