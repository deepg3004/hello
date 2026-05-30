import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AffiliateSignupForm } from "@/components/affiliate/AffiliateSignupForm";

export const metadata = { title: "Promote &amp; earn — affiliate signup" };

export default async function AffiliateJoinPage({
  params,
}: {
  params: { page_id: string };
}) {
  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select(
      "id, title, slug, user_id, status, user_profiles!pages_user_id_fkey(full_name, legal_business_name)",
    )
    .eq("id", params.page_id)
    .single();
  if (!page || page.status !== "published") notFound();

  type Seller = { full_name: string | null; legal_business_name: string | null };
  const sellerRel = (page as unknown as { user_profiles: Seller | Seller[] | null })
    .user_profiles;
  const seller = Array.isArray(sellerRel) ? sellerRel[0] : sellerRel;
  const sellerName =
    seller?.legal_business_name ?? seller?.full_name ?? "the seller";

  const { data: program } = await admin
    .from("affiliates")
    .select("id, commission_type, commission_value, status, terms")
    .eq("page_id", page.id)
    .single();

  if (!program || program.status !== "active") {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Program not active</CardTitle>
            <CardDescription>
              The affiliate program for this page is paused or hasn&apos;t
              launched yet. Check back later.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const commissionLine =
    program.commission_type === "percentage"
      ? `${program.commission_value}% of every sale`
      : `₹${Number(program.commission_value).toLocaleString("en-IN")} per sale`;

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <Card>
        <CardHeader>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            invoxai.io / affiliate
          </p>
          <CardTitle className="text-2xl">
            Promote {page.title} &amp; earn
          </CardTitle>
          <CardDescription className="text-base">
            {sellerName} pays affiliates{" "}
            <strong className="text-foreground">{commissionLine}</strong>. Sign
            up below to get your unique referral link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AffiliateSignupForm
            pageId={page.id}
            pageTitle={page.title}
            pageSlug={page.slug}
            commissionLine={commissionLine}
          />

          {program.terms && (
            <div className="rounded-md border bg-muted/40 p-4 text-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Program terms
              </p>
              <p className="mt-1 whitespace-pre-line text-muted-foreground">
                {program.terms}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
