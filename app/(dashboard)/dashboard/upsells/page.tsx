import Link from "next/link";
import { redirect } from "next/navigation";
import { Zap, ShoppingBag, ArrowUpCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePageActor } from "@/lib/account-context";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { isBumpReady, isOtoReady, type OrderBumpConfig, type OtoConfig } from "@/lib/upsells";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Upsells" };

interface PageRow {
  id: string;
  title: string;
  slug: string;
  page_config: Record<string, unknown> | null;
}

interface UpsellRow {
  kind: "bump" | "oto";
  page_id: string;
  page_title: string;
  page_slug: string;
  product_name: string | null;
  price: number;
  triggered: number;
  accepted: number;
  revenue: number; // gross revenue from accepted upsells (paid only)
  active: boolean;
}

const rupees = (n: number) => formatINR(n * 100);

export default async function UpsellsPage() {
  const ctx = await requirePageActor("pages.view", "/dashboard/upsells");

  const admin = createAdminClient();

  // 1. Load all the seller's pages + their configs.
  const { data: pagesRaw } = await admin
    .from("pages")
    .select("id, title, slug, page_config")
    .eq("user_id", ctx.ownerId)
    .order("created_at", { ascending: false });
  const pages = (pagesRaw ?? []) as PageRow[];

  // 2. Load all orders to compute stats (could be large for big sellers; we
  //    cap at 10k). For finer aggregation we'd move to SQL views later.
  const { data: ordersRaw } = await admin
    .from("orders")
    .select(
      "id, page_id, status, source, amount, bump_offered, bump_accepted, oto_offered, oto_accepted, parent_order_id",
    )
    .eq("seller_user_id", ctx.ownerId)
    .order("created_at", { ascending: false })
    .limit(10_000);
  const orders = ordersRaw ?? [];

  // 3. Look up product names for bump/OTO configs in one shot.
  const productIds = new Set<string>();
  for (const p of pages) {
    const cfg = (p.page_config ?? {}) as { order_bump?: OrderBumpConfig; oto_config?: OtoConfig };
    if (cfg.order_bump?.product_id) productIds.add(cfg.order_bump.product_id);
    if (cfg.oto_config?.product_id) productIds.add(cfg.oto_config.product_id);
  }
  const { data: products } = productIds.size
    ? await admin
        .from("products")
        .select("id, name, price")
        .in("id", Array.from(productIds))
    : { data: [] as Array<{ id: string; name: string; price: number }> };
  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  // 4. Assemble rows.
  const rows: UpsellRow[] = [];
  for (const p of pages) {
    const cfg = (p.page_config ?? {}) as {
      order_bump?: OrderBumpConfig;
      oto_config?: OtoConfig;
    };

    if (isBumpReady(cfg.order_bump)) {
      const product = productMap.get(cfg.order_bump.product_id!);
      const price = Number(cfg.order_bump.price ?? product?.price ?? 0);
      const onThisPage = orders.filter((o) => o.page_id === p.id && o.source !== "oto");
      const triggered = onThisPage.filter((o) => !!o.bump_offered).length;
      const acceptedRows = onThisPage.filter(
        (o) => !!o.bump_accepted && o.status === "paid",
      );
      const accepted = acceptedRows.length;
      const revenue = accepted * price;
      rows.push({
        kind: "bump",
        page_id: p.id,
        page_title: p.title,
        page_slug: p.slug,
        product_name: cfg.order_bump.title ?? product?.name ?? null,
        price,
        triggered,
        accepted,
        revenue,
        active: !!cfg.order_bump.enabled,
      });
    }

    if (isOtoReady(cfg.oto_config)) {
      const product = productMap.get(cfg.oto_config.product_id!);
      const price = Number(cfg.oto_config.price ?? product?.price ?? 0);
      const onThisPage = orders.filter((o) => o.page_id === p.id);
      const triggered = onThisPage.filter((o) => !!o.oto_offered).length;
      const acceptedRows = onThisPage.filter(
        (o) => o.source === "oto" && o.status === "paid",
      );
      const accepted = acceptedRows.length;
      const revenue = acceptedRows.reduce((a, o) => a + Number(o.amount ?? 0), 0);
      rows.push({
        kind: "oto",
        page_id: p.id,
        page_title: p.title,
        page_slug: p.slug,
        product_name: product?.name ?? cfg.oto_config.headline ?? null,
        price,
        triggered,
        accepted,
        revenue,
        active: !!cfg.oto_config.enabled,
      });
    }
  }

  const totalBumpRevenue = rows
    .filter((r) => r.kind === "bump")
    .reduce((a, r) => a + r.revenue, 0);
  const totalOtoRevenue = rows
    .filter((r) => r.kind === "oto")
    .reduce((a, r) => a + r.revenue, 0);

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Upsells"
        gradient="from-fuchsia-600 via-pink-600 to-rose-600"
        blurb="Order bumps and post-purchase OTOs across all your pages. Configure them under each page's Conversion tab."
      />

      <div
        className="grid grid-cols-2 gap-4 animate-in-up md:grid-cols-3"
        style={{ animationDelay: "60ms" }}
      >
        <MetricCard
          label="Active upsells"
          value={rows.filter((r) => r.active).length.toString()}
          icon={Zap}
          accentColor="indigo"
        />
        <MetricCard
          label="Bump revenue"
          value={rupees(totalBumpRevenue)}
          icon={ShoppingBag}
          accentColor="emerald"
        />
        <MetricCard
          label="OTO revenue"
          value={rupees(totalOtoRevenue)}
          icon={ArrowUpCircle}
          accentColor="amber"
        />
      </div>

      <Card className="animate-in-up" style={{ animationDelay: "120ms" }}>
        <CardContent className="overflow-x-auto p-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-full tile-indigo">
                <Zap className="h-5 w-5" />
              </div>
              <p>
                No upsells configured yet. Open a page and enable Order Bump or OTO
                under the <strong>Conversion</strong> tab.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Offer</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Triggered</TableHead>
                  <TableHead className="text-right">Accepted</TableHead>
                  <TableHead className="text-right">Conv %</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const rate =
                    r.triggered > 0
                      ? ((r.accepted / r.triggered) * 100).toFixed(1)
                      : "—";
                  return (
                    <TableRow
                      key={`${r.page_id}-${r.kind}-${i}`}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <TableCell>
                        <Link
                          href={`/dashboard/pages/${r.page_id}/edit`}
                          className="font-medium hover:underline"
                        >
                          {r.page_title}
                        </Link>
                        <div className="text-xs text-muted-foreground">/p/{r.page_slug}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {r.kind === "bump" ? "Order bump" : "OTO"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.product_name ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{rupees(r.price)}</TableCell>
                      <TableCell className="text-right">{r.triggered.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">{r.accepted.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">{rate === "—" ? "—" : `${rate}%`}</TableCell>
                      <TableCell className="text-right font-mono">{rupees(r.revenue)}</TableCell>
                      <TableCell>
                        {r.active ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-800">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline">Paused</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
