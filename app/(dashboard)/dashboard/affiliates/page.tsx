import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePageActor } from "@/lib/account-context";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { AffiliatesDashboard } from "@/components/dashboard/AffiliatesDashboard";

export const metadata = { title: "Affiliates · Dashboard" };

export default async function AffiliatesPage() {
  const ctx = await requirePageActor("affiliates.view", "/dashboard/affiliates");

  const admin = createAdminClient();

  // 1. Seller's payment pages — eligible for an affiliate program.
  const { data: pages } = await admin
    .from("pages")
    .select("id, title, slug, type, status")
    .eq("user_id", ctx.ownerId)
    .in("type", ["payment", "landing"])
    .order("created_at", { ascending: false });

  // 2. Existing program configs keyed by page_id.
  const { data: programs } = await admin
    .from("affiliates")
    .select("id, page_id, commission_type, commission_value, status, terms")
    .eq("user_id", ctx.ownerId);

  // 3. Per-affiliate roll-up.
  const programIds = (programs ?? []).map((p) => p.id);
  const { data: links } = programIds.length
    ? await admin
        .from("affiliate_links")
        .select(
          "id, affiliate_id, referrer_name, referrer_email, referrer_phone, referral_code, clicks, conversions, earnings, paid_amount, status, created_at, bank_account_number, bank_ifsc, bank_holder_name",
        )
        .in("affiliate_id", programIds)
        .order("earnings", { ascending: false })
    : { data: [] };

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Affiliates"
        gradient="from-cyan-600 via-sky-600 to-blue-600"
        blurb="Pay your customers a cut of every sale they bring in. Each page gets its own program — share the join link for affiliates to sign up."
      />

      <div className="animate-in-up" style={{ animationDelay: "80ms" }}>
        <AffiliatesDashboard
        pages={(pages ?? []).map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          type: p.type,
          status: p.status,
        }))}
        programs={(programs ?? []).map((p) => ({
          id: p.id,
          page_id: p.page_id,
          commission_type: p.commission_type as "percentage" | "fixed",
          commission_value: Number(p.commission_value),
          status: p.status as "active" | "paused",
          terms: p.terms,
        }))}
        links={(links ?? []).map((l) => ({
          id: l.id,
          affiliate_id: l.affiliate_id,
          referrer_name: l.referrer_name,
          referrer_email: l.referrer_email,
          referrer_phone: l.referrer_phone,
          referral_code: l.referral_code,
          clicks: Number(l.clicks ?? 0),
          conversions: Number(l.conversions ?? 0),
          earnings: Number(l.earnings ?? 0),
          paid_amount: Number(l.paid_amount ?? 0),
          status: l.status as "active" | "paused",
          created_at: l.created_at,
          has_bank: !!l.bank_account_number,
        }))}
        baseUrl={baseUrl}
        />
      </div>
    </div>
  );
}
