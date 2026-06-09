import { redirect } from "next/navigation";

import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { PageStatCard } from "@/components/dashboard/pages/PageStatCard";
import { LeadsTable, type LeadRow } from "@/components/dashboard/leads/LeadsTable";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePageActor } from "@/lib/account-context";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";
import { dailySeries, seriesTrend } from "@/lib/dashboard/spark";

const HERO_BTN =
  "border-border bg-card text-foreground hover:bg-muted";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  const ctx = await requirePageActor("leads.view", "/dashboard/leads");

  const admin = createAdminClient();
  const [{ data: rowsRaw }, { data: pagesRaw }] = await Promise.all([
    admin
      .from("lead_captures")
      .select(
        "id, page_id, name, email, phone, tags, notes, custom_fields, source, utm, confirmed_at, delivered_magnet, created_at, pages(title)",
      )
      .eq("seller_user_id", ctx.ownerId)
      .order("created_at", { ascending: false })
      .limit(5000),
    admin
      .from("pages")
      .select("id, title")
      .eq("user_id", ctx.ownerId)
      .in("type", ["landing", "lead_magnet"])
      .order("created_at", { ascending: false }),
  ]);

  type Joined = { title: string } | { title: string }[] | null;
  const rows = ((rowsRaw ?? []) as unknown as Array<{
    id: string;
    page_id: string | null;
    name: string | null;
    email: string;
    phone: string | null;
    tags: string[] | null;
    notes: unknown;
    custom_fields: Record<string, unknown> | null;
    source: string | null;
    utm: Record<string, string> | null;
    confirmed_at: string | null;
    delivered_magnet: boolean | null;
    created_at: string;
    pages: Joined;
  }>).map((r) => {
    const p = Array.isArray(r.pages) ? r.pages[0] : r.pages;
    return {
      id: r.id,
      page_id: r.page_id,
      page_title: p?.title ?? null,
      name: r.name,
      email: r.email,
      phone: r.phone,
      tags: Array.isArray(r.tags) ? r.tags : [],
      notes: Array.isArray(r.notes)
        ? (r.notes as Array<{ body: string; by: string; at: string }>)
        : [],
      custom_fields: r.custom_fields ?? {},
      source: r.source,
      utm: r.utm,
      confirmed_at: r.confirmed_at,
      delivered_magnet: !!r.delivered_magnet,
      created_at: r.created_at,
    } satisfies LeadRow;
  });

  // Quick metrics off the snapshot.
  const total = rows.length;
  const uniqueEmails = new Set(rows.map((r) => r.email.toLowerCase())).size;
  const last7d = rows.filter(
    (r) => Date.parse(r.created_at) > Date.now() - 7 * 86_400_000,
  ).length;
  const confirmed = rows.filter((r) => r.confirmed_at).length;
  const sparkLeads = dailySeries(rows, (r) => r.created_at);

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Leads"
        blurb="Every email captured by your landing and lead-magnet pages."
        gradient="from-amber-500 via-orange-500 to-rose-500"
      >
        <ExportCsvButton type="leads" className={HERO_BTN} />
      </DashboardHero>

      <div
        className="flex flex-wrap gap-4 animate-in-up"
        style={{ animationDelay: "60ms" }}
      >
        <PageStatCard
          label="Total Leads"
          value={total.toLocaleString("en-IN")}
          trendPct={seriesTrend(sparkLeads)}
          spark={sparkLeads}
          color="#f59e0b"
        />
        <PageStatCard
          label="Last 7 Days"
          value={last7d.toLocaleString("en-IN")}
          trendPct={null}
          spark={sparkLeads}
          color="#6366f1"
        />
        <PageStatCard
          label="Unique Emails"
          value={uniqueEmails.toLocaleString("en-IN")}
          trendPct={null}
          spark={sparkLeads}
          color="#10b981"
        />
        <PageStatCard
          label="Confirmed"
          value={confirmed.toLocaleString("en-IN")}
          trendPct={null}
          spark={sparkLeads}
          color="#8b5cf6"
        />
      </div>

      <div className="animate-in-up" style={{ animationDelay: "120ms" }}>
        <LeadsTable leads={rows} pages={pagesRaw ?? []} />
      </div>
    </div>
  );
}
