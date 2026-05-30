import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { PORTAL_COOKIE, verifyPortalSession } from "@/lib/affiliate";
import { AffiliateLogin } from "@/components/affiliate/AffiliateLogin";
import { AffiliatePortal } from "@/components/affiliate/AffiliatePortal";

export const metadata = { title: "Affiliate portal" };
export const dynamic = "force-dynamic";

export default async function AffiliatePortalPage() {
  const token = cookies().get(PORTAL_COOKIE)?.value;
  const email = token ? verifyPortalSession(token) : null;
  if (!email) {
    return <AffiliateLogin />;
  }

  const admin = createAdminClient();
  const { data: links } = await admin
    .from("affiliate_links")
    .select(
      "id, affiliate_id, referrer_name, referrer_email, referral_code, clicks, conversions, earnings, paid_amount, status, bank_account_number, bank_ifsc, bank_holder_name, affiliates(page_id, commission_type, commission_value, pages(slug, title, status))",
    )
    .eq("referrer_email", email);

  type Joined = {
    page_id: string;
    commission_type: string;
    commission_value: number;
    pages: { slug: string; title: string; status: string } | { slug: string; title: string; status: string }[] | null;
  };

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";

  const linkIds = (links ?? []).map((l) => l.id);
  const { data: payouts } = linkIds.length
    ? await admin
        .from("affiliate_payouts")
        .select("id, affiliate_link_id, commission_amount, status, paid_at, payment_reference, created_at, order_id")
        .in("affiliate_link_id", linkIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };

  const enrichedLinks = (links ?? []).map((l) => {
    const prog = (l as unknown as { affiliates: Joined | Joined[] | null }).affiliates;
    const program = Array.isArray(prog) ? prog[0] : prog;
    const pageRel = program?.pages;
    const page = Array.isArray(pageRel) ? pageRel[0] : pageRel;
    return {
      id: l.id,
      referrer_name: l.referrer_name,
      referral_code: l.referral_code,
      clicks: Number(l.clicks ?? 0),
      conversions: Number(l.conversions ?? 0),
      earnings: Number(l.earnings ?? 0),
      paid_amount: Number(l.paid_amount ?? 0),
      status: l.status as "active" | "paused",
      page_title: page?.title ?? "Unknown",
      page_slug: page?.slug ?? "",
      page_status: page?.status ?? "draft",
      commission_type: program?.commission_type as "percentage" | "fixed",
      commission_value: Number(program?.commission_value ?? 0),
      bank_account_number: l.bank_account_number,
      bank_ifsc: l.bank_ifsc,
      bank_holder_name: l.bank_holder_name,
    };
  });

  return (
    <AffiliatePortal
      email={email}
      links={enrichedLinks}
      payouts={(payouts ?? []).map((p) => ({
        id: p.id,
        affiliate_link_id: p.affiliate_link_id,
        commission_amount: Number(p.commission_amount ?? 0),
        status: p.status as "pending" | "paid" | "cancelled",
        paid_at: p.paid_at,
        payment_reference: p.payment_reference,
        created_at: p.created_at,
        order_id: p.order_id,
      }))}
      baseUrl={baseUrl}
    />
  );
}
