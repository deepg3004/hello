import { redirect } from "next/navigation";

import { MetricCard } from "@/components/dashboard/MetricCard";
import { LeadsTable, type LeadRow } from "@/components/dashboard/leads/LeadsTable";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [{ data: rowsRaw }, { data: pagesRaw }] = await Promise.all([
    admin
      .from("lead_captures")
      .select(
        "id, page_id, name, email, phone, tags, notes, custom_fields, source, utm, confirmed_at, delivered_magnet, created_at, pages(title)",
      )
      .eq("seller_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5000),
    admin
      .from("pages")
      .select("id, title")
      .eq("user_id", user.id)
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-sora font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Every email captured by your landing and lead-magnet pages.
          </p>
        </div>
        <ExportCsvButton type="leads" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Total leads" value={total.toLocaleString("en-IN")} />
        <MetricCard label="Unique emails" value={uniqueEmails.toLocaleString("en-IN")} />
        <MetricCard label="Last 7 days" value={last7d.toLocaleString("en-IN")} />
      </div>

      <LeadsTable leads={rows} pages={pagesRaw ?? []} />
    </div>
  );
}
