import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SellerProvider } from "@/components/dashboard/SellerContext";
import type { TopbarProfile } from "@/components/dashboard/Topbar";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActorContext, listActingAccounts } from "@/lib/account-context";
import { isMaintenanceOn } from "@/lib/maintenance";
import { getBranding } from "@/lib/settings";
import { platformRootDomain } from "@/lib/domains";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // RBAC (Session 15): the dashboard acts on ctx.ownerId — the user's own
  // account, or an owner's account they're an active team member of. Chrome
  // (wallet / subdomain / plan) reflects that OWNER; the topbar identity stays
  // the logged-in member.
  const ctx = await getActorContext();
  if (!ctx) redirect("/login?next=/dashboard");

  const admin = createAdminClient();
  const [{ data: meRow }, { data: ownerRow }] = await Promise.all([
    admin
      .from("user_profiles")
      .select("full_name, email, avatar_url, is_admin")
      .eq("id", ctx.authUserId)
      .single(),
    admin
      .from("user_profiles")
      .select("full_name, email, subscription_plan, subscription_status, subdomain")
      .eq("id", ctx.ownerId)
      .single(),
  ]);

  // Guarantee the OWNER has a subdomain before the dashboard opens. Only the
  // owner themselves provisions it (a team member never creates it).
  let subdomain = ownerRow?.subdomain ?? null;
  if (ctx.isOwner && ownerRow && !subdomain) {
    const { ensureSubdomainForUser } = await import("@/lib/subdomain");
    subdomain = await ensureSubdomainForUser(
      ctx.ownerId,
      ownerRow.full_name ?? ownerRow.email ?? "seller",
    );
  }
  const sellerOrigin = subdomain
    ? `https://${subdomain}.${platformRootDomain()}`
    : null;

  // Maintenance gate — platform admins (the logged-in user) bypass.
  if (!meRow?.is_admin && (await isMaintenanceOn())) {
    redirect("/maintenance");
  }

  const branding = await getBranding();

  // Wallet balance chip — the OWNER account's balance. Best-effort → ₹0.
  const { data: walletRow } = await admin
    .from("seller_wallets")
    .select("balance_paise")
    .eq("seller_user_id", ctx.ownerId)
    .maybeSingle();
  const walletBalancePaise = Number(walletRow?.balance_paise ?? 0);

  const profile: TopbarProfile = {
    full_name: meRow?.full_name ?? null,
    email: meRow?.email ?? "",
    avatar_url: meRow?.avatar_url ?? null,
    subscription_plan: ownerRow?.subscription_plan ?? "free",
    subscription_status: ownerRow?.subscription_status ?? "inactive",
  };

  const accounts = await listActingAccounts(ctx.authUserId, meRow?.email ?? null);

  return (
    <DashboardShell
      profile={profile}
      branding={branding}
      walletBalancePaise={walletBalancePaise}
      role={ctx.role}
      accounts={accounts}
      activeOwnerId={ctx.ownerId}
    >
      <SellerProvider origin={sellerOrigin}>{children}</SellerProvider>
    </DashboardShell>
  );
}
