import { CheckCircle2, Clock, Send, UserX } from "lucide-react";

import { MetricCard } from "@/components/dashboard/MetricCard";
import {
  AdminTelegramClient,
  type AdminTelegramRow,
} from "@/components/admin/AdminTelegramClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

export const metadata = { title: "Admin · Telegram" };

interface MemRow {
  id: string;
  telegram_user_id: string | null;
  buyer_email: string;
  status: string;
  invited_at: string | null;
  joined_at: string | null;
  expires_at: string | null;
  telegram_group_id: string;
  telegram_vip_groups: { group_name: string | null; group_id: string; user_id: string } | { group_name: string | null; group_id: string; user_id: string }[] | null;
}

export default async function AdminTelegramPage() {
  const admin = createAdminClient();
  // telegram_memberships has 2 FKs to telegram_vip_groups (the legacy group_id
  // from migration 001 and the new telegram_group_id from migration 021).
  // Disambiguate so PostgREST follows the new FK that the code actually uses.
  const { data: memsRaw } = await admin
    .from("telegram_memberships")
    .select(
      "id, telegram_user_id, buyer_email, status, invited_at, joined_at, expires_at, telegram_group_id, telegram_vip_groups!telegram_memberships_telegram_group_id_fkey(group_name, group_id, user_id)",
    )
    .order("invited_at", { ascending: false })
    .limit(500);

  const mems = (memsRaw ?? []) as unknown as MemRow[];

  const active = mems.filter((m) => m.status === "active").length;
  const invited = mems.filter((m) => m.status === "invited").length;
  const expired = mems.filter((m) => m.status === "expired").length;
  const removed = mems.filter((m) => m.status === "removed").length;

  const rows: AdminTelegramRow[] = mems.map((m) => {
    const group = Array.isArray(m.telegram_vip_groups)
      ? m.telegram_vip_groups[0]
      : m.telegram_vip_groups;
    return {
      id: m.id,
      buyer_email: m.buyer_email,
      telegram_user_id: m.telegram_user_id,
      status: m.status,
      joined_at: m.joined_at,
      expires_at: m.expires_at,
      group_name: group?.group_name ?? null,
      group_id: group?.group_id ?? m.telegram_group_id,
      owner_user_id: group?.user_id ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <DashboardHero
          title="Telegram VIP memberships"
          blurb="Every paid invite, join, expiry and removal across every seller's VIP group."
          resourcesHref={null}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 animate-in-up md:grid-cols-4" style={{ animationDelay: "60ms" }}>
        <MetricCard label="Active" value={active.toLocaleString("en-IN")} icon={CheckCircle2} accentColor="emerald" />
        <MetricCard label="Invited" value={invited.toLocaleString("en-IN")} hint="Awaiting join" icon={Send} accentColor="indigo" />
        <MetricCard label="Expired" value={expired.toLocaleString("en-IN")} icon={Clock} accentColor="amber" />
        <MetricCard label="Removed" value={removed.toLocaleString("en-IN")} icon={UserX} accentColor="rose" />
      </div>

      <div className="animate-in-up" style={{ animationDelay: "120ms" }}>
        <AdminTelegramClient rows={rows} />
      </div>
    </div>
  );
}
