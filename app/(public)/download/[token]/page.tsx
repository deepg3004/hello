// Friendly landing for a digital download link (emailed + linked from My
// Account). Shows the file + remaining downloads and a button that triggers the
// actual download via /api/download/<token>.

import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { Download } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function DownloadPage({ params }: { params: { token: string } }) {
  noStore();
  const admin = createAdminClient();
  const { data: grant } = await admin
    .from("download_grants")
    .select("file_name, download_limit, downloads_used, product_id, products(name)")
    .eq("token", params.token)
    .maybeSingle();
  if (!grant) notFound();

  const prod = Array.isArray(grant.products) ? grant.products[0] : grant.products;
  const name = (prod as { name?: string } | null)?.name ?? grant.file_name ?? "Your download";
  const limit = grant.download_limit as number | null;
  const used = (grant.downloads_used as number) ?? 0;
  const remaining = limit == null ? null : Math.max(0, limit - used);
  const exhausted = remaining === 0;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="w-full rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Download className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold">{name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {limit == null
            ? "Unlimited downloads"
            : exhausted
              ? "Download limit reached"
              : `${remaining} of ${limit} download${limit === 1 ? "" : "s"} remaining`}
        </p>

        {exhausted ? (
          <p className="mt-6 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
            You&apos;ve used all your downloads for this purchase. Contact the seller if you need help.
          </p>
        ) : (
          <a
            href={`/api/download/${params.token}`}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Download className="h-4 w-4" /> Download now
          </a>
        )}
      </div>
    </main>
  );
}
