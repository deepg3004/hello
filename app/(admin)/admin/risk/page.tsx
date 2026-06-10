// Admin · Risk & Abuse — the review queue for orders auto-flagged at checkout
// (velocity / duplicate / high-value), the email/IP/phone blocklist manager,
// and the risk-scoring thresholds. Hard blocks live in `risk_blocklist`;
// flags are advisory (migration 093).

import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { listBlocklist } from "@/lib/risk/blocklist";
import { DEFAULT_THRESHOLDS } from "@/lib/risk/evaluate";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  AdminRiskClient,
  type FlaggedOrder,
  type RiskFlagChip,
} from "@/components/admin/AdminRiskClient";

export const metadata = { title: "Admin · Risk & Abuse" };

export default async function AdminRiskPage() {
  const admin = createAdminClient();

  const [{ data: flaggedRaw }, blocklist, settings] = await Promise.all([
    admin
      .from("orders")
      .select(
        "id, buyer_email, buyer_phone, ip_address, amount, currency, status, risk_score, risk_flags, flagged_at, seller_user_id",
      )
      .eq("review_status", "flagged")
      .order("flagged_at", { ascending: false })
      .limit(200),
    listBlocklist(),
    getSettings({
      risk_velocity_email_per_hour: String(DEFAULT_THRESHOLDS.velocityEmailPerHour),
      risk_velocity_ip_per_hour: String(DEFAULT_THRESHOLDS.velocityIpPerHour),
      risk_high_value_inr: String(DEFAULT_THRESHOLDS.highValueInr),
      risk_duplicate_window_min: String(DEFAULT_THRESHOLDS.duplicateWindowMin),
      risk_flag_threshold: String(DEFAULT_THRESHOLDS.flagThreshold),
    }),
  ]);

  const flagged: FlaggedOrder[] = (flaggedRaw ?? []).map((o) => ({
    id: o.id as string,
    email: (o.buyer_email as string | null) ?? "—",
    phone: (o.buyer_phone as string | null) ?? null,
    ip: (o.ip_address as string | null) ?? null,
    amount: Number(o.amount ?? 0),
    currency: (o.currency as string | null) ?? "INR",
    status: (o.status as string | null) ?? "pending",
    score: Number(o.risk_score ?? 0),
    flags: ((o.risk_flags as RiskFlagChip[] | null) ?? []).map((f) => ({
      code: f.code,
      label: f.label,
    })),
    flaggedAt: (o.flagged_at as string | null) ?? null,
  }));

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Risk & Abuse"
        blurb="Review auto-flagged orders, manage the email/IP/phone blocklist, and tune the fraud-scoring thresholds."
        resourcesHref={null}
      />
      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <AdminRiskClient
          flagged={flagged}
          blocklist={blocklist}
          thresholds={{
            risk_velocity_email_per_hour: Number(settings.risk_velocity_email_per_hour),
            risk_velocity_ip_per_hour: Number(settings.risk_velocity_ip_per_hour),
            risk_high_value_inr: Number(settings.risk_high_value_inr),
            risk_duplicate_window_min: Number(settings.risk_duplicate_window_min),
            risk_flag_threshold: Number(settings.risk_flag_threshold),
          }}
        />
      </div>
    </div>
  );
}
