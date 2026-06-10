// Admin · Buyer Accounts — portal accounts (Google / email-OTP) + login audit.
// Distinct from Customers (which is order-derived): this is who has actually
// signed into the buyer portal, with profile + login history (migration 087).

import {
  AdminBuyersClient,
  type AdminBuyerRow,
  type AdminBuyerLoginRow,
} from "@/components/admin/AdminBuyersClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

export const metadata = { title: "Admin · Buyer Accounts" };

export default async function AdminBuyersPage() {
  const admin = createAdminClient();

  const [{ data: buyers }, { data: events }] = await Promise.all([
    admin
      .from("buyers")
      .select("email, name, avatar_url, primary_provider, email_verified, login_count, last_login_at")
      .order("last_login_at", { ascending: false })
      .limit(2000),
    admin
      .from("buyer_login_events")
      .select("email, provider, host, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const rows: AdminBuyerRow[] = (buyers ?? []).map((b) => ({
    email: b.email as string,
    name: (b.name as string | null) ?? null,
    avatarUrl: (b.avatar_url as string | null) ?? null,
    provider: (b.primary_provider as "google" | "email_otp") ?? "email_otp",
    emailVerified: !!b.email_verified,
    loginCount: Number(b.login_count ?? 0),
    lastLoginAt: b.last_login_at as string,
  }));

  const logins: AdminBuyerLoginRow[] = (events ?? []).map((e) => ({
    email: e.email as string,
    provider: (e.provider as "google" | "email_otp") ?? "email_otp",
    host: (e.host as string | null) ?? null,
    createdAt: e.created_at as string,
  }));

  return (
    <div className="space-y-6">
      <DashboardHero
        title="Buyer accounts"
        blurb="Everyone who has signed into the buyer portal, with their provider and login history."
        resourcesHref={null}
      />
      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <AdminBuyersClient rows={rows} logins={logins} />
      </div>
    </div>
  );
}
