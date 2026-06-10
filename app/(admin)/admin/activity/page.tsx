// Admin · Activity — a unified, read-only timeline of what's happening across
// the platform, aggregated from existing event sources (no new write paths):
// sales, wallet movements, AI generations, buyer logins, new signups, and admin
// actions. Complements /admin/audit-logs (admin actions only).

import {
  AdminActivityClient,
  type ActivityEvent,
} from "@/components/admin/AdminActivityClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Admin · Activity" };
export const dynamic = "force-dynamic";

const inrFromRupees = (n: number) => formatINR(Math.round(Number(n || 0) * 100));
const inrFromPaise = (p: number) => formatINR(Number(p || 0));

export default async function AdminActivityPage() {
  const admin = createAdminClient();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthIso = monthStart.toISOString();

  const [
    { data: orders },
    { data: wallet },
    { data: ai },
    { data: logins },
    { data: audit },
    { data: signups },
    sellersCount,
    buyersCount,
    ordersMonthCount,
    aiMonthCount,
  ] = await Promise.all([
    admin.from("orders").select("seller_user_id, buyer_name, buyer_email, amount, status, created_at").in("status", ["paid", "refunded", "partially_refunded"]).order("created_at", { ascending: false }).limit(150),
    admin.from("wallet_transactions").select("seller_user_id, type, amount_paise, description, created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("builder_ai_generations").select("user_id, status, brief_json, created_at").order("created_at", { ascending: false }).limit(80),
    admin.from("buyer_login_events").select("email, provider, host, created_at").order("created_at", { ascending: false }).limit(80),
    admin.from("admin_audit_logs").select("admin_id, action, target_type, created_at").order("created_at", { ascending: false }).limit(80),
    admin.from("user_profiles").select("id, full_name, email, subscription_plan, created_at").eq("is_admin", false).order("created_at", { ascending: false }).limit(50),
    admin.from("user_profiles").select("id", { count: "exact", head: true }).eq("is_admin", false),
    admin.from("buyers").select("id", { count: "exact", head: true }),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid").gte("created_at", monthIso),
    admin.from("builder_ai_generations").select("id", { count: "exact", head: true }).eq("status", "success").gte("created_at", monthIso),
  ]);

  // Resolve user ids → display name in one batch (avoids N+1).
  const ids = new Set<string>();
  for (const o of orders ?? []) if (o.seller_user_id) ids.add(o.seller_user_id as string);
  for (const w of wallet ?? []) if (w.seller_user_id) ids.add(w.seller_user_id as string);
  for (const a of ai ?? []) if (a.user_id) ids.add(a.user_id as string);
  for (const a of audit ?? []) if (a.admin_id) ids.add(a.admin_id as string);
  const nameOf = new Map<string, string>();
  if (ids.size) {
    const { data: profs } = await admin
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", [...ids]);
    for (const p of profs ?? []) nameOf.set(p.id as string, (p.full_name as string) || (p.email as string) || "Seller");
  }
  const seller = (id: string | null) => (id ? nameOf.get(id) ?? "Seller" : "—");

  const events: ActivityEvent[] = [];

  for (const o of orders ?? []) {
    events.push({
      at: o.created_at as string,
      module: "sale",
      actor: (o.buyer_name as string) || (o.buyer_email as string) || "Buyer",
      title: o.status === "paid" ? "Order paid" : `Order ${o.status}`,
      detail: `${inrFromRupees(o.amount as number)} · seller ${seller(o.seller_user_id as string | null)}`,
    });
  }
  for (const w of wallet ?? []) {
    events.push({
      at: w.created_at as string,
      module: "wallet",
      actor: seller(w.seller_user_id as string),
      title: w.type === "credit" ? "Wallet recharge" : "Platform fee debit",
      detail: `${inrFromPaise(w.amount_paise as number)} · ${(w.description as string) ?? ""}`,
    });
  }
  for (const a of ai ?? []) {
    const brief = (a.brief_json ?? {}) as { businessName?: string };
    events.push({
      at: a.created_at as string,
      module: "ai",
      actor: seller(a.user_id as string),
      title: a.status === "success" ? "AI page generated" : "AI generation failed",
      detail: brief.businessName ? `“${brief.businessName}”` : undefined,
    });
  }
  for (const l of logins ?? []) {
    events.push({
      at: l.created_at as string,
      module: "buyer",
      actor: (l.email as string) ?? "Buyer",
      title: `Buyer login (${l.provider === "google" ? "Google" : "email OTP"})`,
      detail: (l.host as string) ?? undefined,
    });
  }
  for (const s of signups ?? []) {
    events.push({
      at: s.created_at as string,
      module: "signup",
      actor: (s.full_name as string) || (s.email as string) || "New user",
      title: "New seller signup",
      detail: `${s.subscription_plan ?? "free"} plan`,
    });
  }
  for (const a of audit ?? []) {
    events.push({
      at: a.created_at as string,
      module: "admin",
      actor: seller(a.admin_id as string | null),
      title: (a.action as string) ?? "Admin action",
      detail: (a.target_type as string) ?? undefined,
    });
  }

  events.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Activity"
        blurb="A live, platform-wide timeline — sales, wallet, AI, buyer logins, signups and admin actions in one place."
        resourcesHref={null}
      />
      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <AdminActivityClient
          events={events.slice(0, 250)}
          stats={{
            sellers: sellersCount.count ?? 0,
            buyers: buyersCount.count ?? 0,
            ordersThisMonth: ordersMonthCount.count ?? 0,
            aiThisMonth: aiMonthCount.count ?? 0,
          }}
        />
      </div>
    </div>
  );
}
