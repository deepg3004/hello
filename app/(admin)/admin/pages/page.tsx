import Link from "next/link";
import { format } from "date-fns";
import { Flag, FileText } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { PageActionsMenu } from "@/components/admin/PageActionsMenu";
import { PageFeeCategorySelect } from "@/components/admin/PageFeeCategorySelect";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeeConfig } from "@/lib/settings";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { publicPagePath } from "@/lib/page-url";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Admin · Pages" };

const rupees = (n: number) => formatINR(n * 100);

export default async function AdminPagesPage() {
  const admin = createAdminClient();
  // pages has TWO FKs to user_profiles (user_id + flagged_by_admin_id).
  // PostgREST throws PGRST201 unless we disambiguate which FK to follow —
  // here we want the page owner, not the admin who flagged it.
  const [{ data: rowsRaw }, feeCfg] = await Promise.all([
    admin
      .from("pages")
      .select(
        "id, title, slug, type, template_id, status, view_count, conversion_count, total_revenue, flagged_at, flag_reason, created_at, user_id, fee_category, user_profiles!pages_user_id_fkey(full_name, email)",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    getFeeConfig(),
  ]);

  const feeCategoryOptions = feeCfg.categories.map((c) => ({
    key: c.key,
    label: c.label,
  }));

  const rows = (rowsRaw ?? []) as unknown as Array<{
    id: string;
    title: string;
    slug: string;
    type: string;
    template_id: string | null;
    status: string;
    view_count: number;
    conversion_count: number;
    total_revenue: number;
    flagged_at: string | null;
    flag_reason: string | null;
    created_at: string;
    user_id: string;
    fee_category: string | null;
    user_profiles: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  }>;

  return (
    <div className="space-y-6">
      <div>
        <DashboardHero
          title="Pages"
          blurb="Every page across every seller. Flagged pages show a warning to the seller."
          resourcesHref={null}
        />
      </div>

      <Card className="animate-in-up" style={{ animationDelay: "80ms" }}>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="th-label">Title</TableHead>
                <TableHead className="th-label">Seller</TableHead>
                <TableHead className="th-label">Type</TableHead>
                <TableHead className="th-label">Status</TableHead>
                <TableHead className="th-label text-right">Views</TableHead>
                <TableHead className="th-label text-right">Revenue</TableHead>
                <TableHead className="th-label">Fee category</TableHead>
                <TableHead className="th-label">Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full tile-indigo">
                        <FileText className="h-5 w-5" />
                      </div>
                      No pages on the platform yet.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const seller = Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles;
                  return (
                    <TableRow key={r.id} className="transition-colors hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link href={publicPagePath(r.type, r.slug, r.template_id)} target="_blank" className="font-medium hover:underline">
                            {r.title}
                          </Link>
                          {r.flagged_at && (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100" title={r.flag_reason ?? ""}>
                              <Flag className="mr-1 h-3 w-3" /> Flagged
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{publicPagePath(r.type, r.slug, r.template_id)}</div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/admin/users/${r.user_id}`} className="hover:underline">
                          {seller?.full_name ?? seller?.email ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{r.type.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(r.view_count ?? 0).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {rupees(Number(r.total_revenue ?? 0))}
                      </TableCell>
                      <TableCell>
                        <PageFeeCategorySelect
                          pageId={r.id}
                          current={r.fee_category}
                          options={feeCategoryOptions}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(r.created_at), "d MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <PageActionsMenu
                          pageId={r.id}
                          pageSlug={r.slug}
                          pagePath={publicPagePath(r.type, r.slug, r.template_id)}
                          flagged={!!r.flagged_at}
                          status={r.status}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
