// Dashboard · Activity — the seller's own activity timeline: their sales,
// wallet movements and AI generations, aggregated from existing data (no new
// write paths). Mirrors /admin/activity but scoped to the signed-in seller.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatINR } from "@/lib/utils";
import {
  ActivityTimeline,
  ActivityStat,
  type ActivityEvent,
  type FilterChip,
} from "@/components/shared/ActivityTimeline";
import { IndianRupee, ShoppingBag, Sparkles, Wallet } from "lucide-react";

export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

const inrFromRupees = (n: number) => formatINR(Math.round(Number(n || 0) * 100));
const inrFromPaise = (p: number) => formatINR(Number(p || 0));

const FILTERS: FilterChip[] = [
  { key: "all", label: "All" },
  { key: "sale", label: "Sales" },
  { key: "wallet", label: "Wallet" },
  { key: "ai", label: "AI" },
];

export default async function DashboardActivityPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthIso = monthStart.toISOString();

  const [
    { data: orders },
    { data: wallet },
    { data: ai },
    { data: walletRow },
    { data: monthOrders },
    aiMonthCount,
  ] = await Promise.all([
    admin.from("orders").select("buyer_name, buyer_email, amount, status, created_at").eq("seller_user_id", user.id).in("status", ["paid", "refunded", "partially_refunded"]).order("created_at", { ascending: false }).limit(120),
    admin.from("wallet_transactions").select("type, amount_paise, description, created_at").eq("seller_user_id", user.id).order("created_at", { ascending: false }).limit(80),
    admin.from("builder_ai_generations").select("status, brief_json, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(60),
    admin.from("seller_wallets").select("balance_paise").eq("seller_user_id", user.id).maybeSingle(),
    admin.from("orders").select("amount").eq("seller_user_id", user.id).eq("status", "paid").gte("created_at", monthIso).limit(5000),
    admin.from("builder_ai_generations").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "success").gte("created_at", monthIso),
  ]);

  const events: ActivityEvent[] = [];
  for (const o of orders ?? []) {
    events.push({
      at: o.created_at as string,
      module: "sale",
      actor: (o.buyer_name as string) || (o.buyer_email as string) || "Buyer",
      title: o.status === "paid" ? "Order paid" : `Order ${o.status}`,
      detail: inrFromRupees(o.amount as number),
    });
  }
  for (const w of wallet ?? []) {
    events.push({
      at: w.created_at as string,
      module: "wallet",
      actor: w.type === "credit" ? "Recharge" : "Platform fee",
      title: w.type === "credit" ? "Wallet recharge" : "Platform fee debit",
      detail: `${inrFromPaise(w.amount_paise as number)} · ${(w.description as string) ?? ""}`,
    });
  }
  for (const a of ai ?? []) {
    const brief = (a.brief_json ?? {}) as { businessName?: string };
    events.push({
      at: a.created_at as string,
      module: "ai",
      actor: brief.businessName ? `“${brief.businessName}”` : "AI",
      title: a.status === "success" ? "AI page generated" : "AI generation failed",
    });
  }
  events.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());

  const monthRevenue = (monthOrders ?? []).reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const monthOrderCount = (monthOrders ?? []).length;

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-sora text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Your recent sales, wallet movements and AI page generations in one timeline.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ActivityStat label="Orders this month" value={monthOrderCount} tile="tile-emerald" icon={ShoppingBag} />
        <ActivityStat label="Revenue this month" value={inrFromRupees(monthRevenue)} tile="tile-indigo" icon={IndianRupee} />
        <ActivityStat label="AI pages this month" value={aiMonthCount.count ?? 0} tile="tile-violet" icon={Sparkles} />
        <ActivityStat label="Wallet balance" value={inrFromPaise(Number(walletRow?.balance_paise ?? 0))} tile="tile-amber" icon={Wallet} />
      </div>

      <ActivityTimeline events={events.slice(0, 250)} filters={FILTERS} />
    </div>
  );
}
