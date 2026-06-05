import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePageActor } from "@/lib/account-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ABTestClient } from "@/components/dashboard/ABTestClient";

export const metadata = { title: "A/B test · Page" };

interface PageRow {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  type: "payment" | "landing" | "lead_magnet";
  page_config: Record<string, unknown> | null;
  variant_b_config: Record<string, unknown> | null;
  experiment_status: string | null;
  traffic_split: number | string | null;
  success_metric: string | null;
  experiment_started_at: string | null;
  experiment_ended_at: string | null;
  template_id: string;
}

interface HistoryRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  success_metric: string;
  traffic_split: number | string;
  visitors_a: number | null;
  visitors_b: number | null;
  conversions_a: number | null;
  conversions_b: number | null;
  revenue_a: number | string | null;
  revenue_b: number | string | null;
  confidence: number | string | null;
  winner: string | null;
  outcome: string;
}

export default async function ABTestPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requirePageActor("pages.view", "/dashboard/pages");

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("pages")
    .select(
      "id, user_id, title, slug, type, page_config, variant_b_config, experiment_status, traffic_split, success_metric, experiment_started_at, experiment_ended_at, template_id",
    )
    .eq("id", params.id)
    .single<PageRow>();
  if (!page) notFound();
  if (page.user_id !== ctx.ownerId) redirect("/dashboard/pages");

  const { data: history } = await admin
    .from("page_experiments")
    .select(
      "id, started_at, ended_at, success_metric, traffic_split, visitors_a, visitors_b, conversions_a, conversions_b, revenue_a, revenue_b, confidence, winner, outcome",
    )
    .eq("page_id", page.id)
    .order("started_at", { ascending: false })
    .limit(20);

  const defaultMetric =
    page.type === "landing" ? "form_submission" : "payment_conversion";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            <Link href="/dashboard/pages" className="hover:underline">
              Pages
            </Link>{" "}
            ·{" "}
            <Link
              href={`/dashboard/pages/${page.id}/edit`}
              className="hover:underline"
            >
              {page.title}
            </Link>
          </p>
          <h1 className="text-2xl font-sora font-semibold tracking-tight">A/B test</h1>
          <p className="text-sm text-muted-foreground">
            Run two variants of the same page side-by-side and let the data
            pick the winner.
          </p>
        </div>
        <Badge variant="outline" className="capitalize">
          {page.experiment_status ?? "idle"}
        </Badge>
      </div>

      <ABTestClient
        pageId={page.id}
        slug={page.slug}
        templateId={page.template_id}
        pageConfig={(page.page_config ?? {}) as Record<string, unknown>}
        variantBConfig={
          (page.variant_b_config ?? null) as Record<string, unknown> | null
        }
        experimentStatus={page.experiment_status ?? "idle"}
        trafficSplit={
          page.traffic_split != null ? Number(page.traffic_split) : 50
        }
        successMetric={
          (page.success_metric ?? defaultMetric) as
            | "payment_conversion"
            | "form_submission"
        }
        pageType={page.type}
        startedAt={page.experiment_started_at}
      />

      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Experiment history</CardTitle>
            <CardDescription>
              Past A/B tests on this page, with their final numbers.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2 text-left">Ran</th>
                  <th className="px-4 py-2 text-left">Metric</th>
                  <th className="px-4 py-2 text-right">Split</th>
                  <th className="px-4 py-2 text-right">Visitors A / B</th>
                  <th className="px-4 py-2 text-right">Conv A / B</th>
                  <th className="px-4 py-2 text-right">Confidence</th>
                  <th className="px-4 py-2 text-left">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {(history as HistoryRow[]).map((h) => {
                  const va = Number(h.visitors_a ?? 0);
                  const vb = Number(h.visitors_b ?? 0);
                  const ca = Number(h.conversions_a ?? 0);
                  const cb = Number(h.conversions_b ?? 0);
                  const conf = Number(h.confidence ?? 0);
                  return (
                    <tr key={h.id} className="border-b last:border-0">
                      <td className="px-4 py-2 text-muted-foreground">
                        {format(new Date(h.started_at), "d MMM yyyy")}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {h.success_metric.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {Number(h.traffic_split).toFixed(0)}% / {(100 - Number(h.traffic_split)).toFixed(0)}%
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {va} / {vb}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {ca} / {cb}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {(conf * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 capitalize">
                        <span
                          className={
                            h.outcome === "promoted"
                              ? "text-emerald-600"
                              : "text-muted-foreground"
                          }
                        >
                          {h.outcome}
                          {h.winner && h.winner !== "inconclusive"
                            ? ` · ${h.winner}`
                            : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
