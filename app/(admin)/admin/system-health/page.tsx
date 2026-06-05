// Admin · System Health (Session 17) — read-only platform diagnostics: DB +
// Redis reachability, required-env presence (never values), and live counts.

import { CheckCircle2, Database, KeyRound, Server, XCircle } from "lucide-react";

import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRedis } from "@/lib/redis";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin · System Health" };
export const dynamic = "force-dynamic";

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GATEWAY_ENCRYPTION_KEY",
  "REDIS_URL",
  "BUYER_PORTAL_SECRET",
  "BUYER_OTP_SALT",
];

export default async function SystemHealthPage() {
  const admin = createAdminClient();

  // ── DB ping + latency ──
  let dbOk = false;
  let dbMs = 0;
  try {
    const t = Date.now();
    const { error } = await admin.from("user_profiles").select("id", { count: "exact", head: true });
    dbOk = !error;
    dbMs = Date.now() - t;
  } catch {
    dbOk = false;
  }

  // ── Redis ping ──
  let redisConfigured = false;
  let redisOk = false;
  try {
    const r = getRedis();
    if (r) {
      redisConfigured = true;
      const pong = await r.ping();
      redisOk = pong === "PONG";
    }
  } catch {
    redisOk = false;
  }

  // ── Live counts ──
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [sellers, ordersToday, failed24, openTickets] = await Promise.all([
    admin.from("user_profiles").select("id", { count: "exact", head: true }),
    admin.from("orders").select("id", { count: "exact", head: true }).gte("created_at", startOfDay.toISOString()),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since24),
    admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  const env = ENV_KEYS.map((k) => ({ key: k, set: !!process.env[k] }));

  return (
    <div className="space-y-6">
      <DashboardHero
        title="System Health"
        blurb="Live platform diagnostics — database, cache, configuration and activity."
        resourcesHref={null}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <ServiceCard
          icon={Database}
          name="Database"
          ok={dbOk}
          detail={dbOk ? `Reachable · ${dbMs}ms` : "Unreachable"}
        />
        <ServiceCard
          icon={Server}
          name="Redis"
          ok={redisConfigured ? redisOk : true}
          detail={!redisConfigured ? "Not configured (optional)" : redisOk ? "PONG" : "Configured but unreachable"}
          warn={redisConfigured && !redisOk}
        />
      </div>

      <div className="card-surface p-5">
        <h2 className="mb-3 flex items-center gap-2 font-sora text-sm font-semibold">
          <KeyRound className="h-4 w-4" /> Required configuration
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {env.map((e) => (
            <div key={e.key} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <span className="truncate font-mono text-xs">{e.key}</span>
              {e.set ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> set
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-rose-600">
                  <XCircle className="h-4 w-4" /> missing
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CountCard label="Sellers" value={sellers.count ?? 0} />
        <CountCard label="Orders today" value={ordersToday.count ?? 0} />
        <CountCard label="Failed payments (24h)" value={failed24.count ?? 0} />
        <CountCard label="Open tickets" value={openTickets.count ?? 0} />
      </div>
    </div>
  );
}

function ServiceCard({
  icon: Icon,
  name,
  ok,
  detail,
  warn,
}: {
  icon: typeof Database;
  name: string;
  ok: boolean;
  detail: string;
  warn?: boolean;
}) {
  return (
    <div className="card-surface flex items-center gap-3 p-4">
      <span
        aria-hidden
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          ok && !warn ? "tile-emerald" : warn ? "tile-amber" : "tile-rose",
        )}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="font-sora text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-surface p-4">
      <p className="th-label">{label}</p>
      <p className="mt-0.5 font-sora text-2xl font-bold tabular-nums">{value.toLocaleString("en-IN")}</p>
    </div>
  );
}
