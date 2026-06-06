import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CreditCard,
  FileText,
  IndianRupee,
  Mail,
  Phone,
  Receipt,
  Wallet,
} from "lucide-react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { UserActions } from "@/components/admin/UserActions";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicPagePath } from "@/lib/page-url";
import { PLANS } from "@/lib/plans";
import { cn, formatDate, formatDateTime, formatINR } from "@/lib/utils";

export const metadata = { title: "Admin · User detail" };

const rupees = (n: number) => formatINR(n * 100);

// Plan badge palette — shared with UsersTable
const PLAN_BADGE: Record<string, string> = {
  free: "bg-muted text-muted-foreground border-border dark:bg-zinc-500/15 dark:text-zinc-300 dark:border-zinc-500/30",
  starter: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  pro: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30",
  business: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
};

const AVATAR_GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-sky-500 to-blue-600",
] as const;

function gradientFor(email: string): string {
  let h = 2166136261;
  for (let i = 0; i < email.length; i++) {
    h ^= email.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length]!;
}

function initials(s: string): string {
  return s
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const admin = createAdminClient();
  const [
    { data: profile },
    { data: pages },
    { data: orders },
    { data: subs },
    { data: notes },
    { data: auditTrail },
    { count: totalOrders },
    { data: walletRow },
    { data: gatewayRow },
  ] = await Promise.all([
    admin.from("user_profiles").select("*").eq("id", params.id).single(),
    admin
      .from("pages")
      .select(
        "id, title, slug, status, type, template_id, view_count, total_revenue, created_at",
      )
      .eq("user_id", params.id)
      .order("created_at", { ascending: false }),
    admin
      .from("orders")
      .select("id, buyer_email, buyer_name, amount, status, created_at")
      .eq("seller_user_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("user_subscriptions")
      .select("id, plan, status, amount, starts_at, ends_at, cancelled_at")
      .eq("user_id", params.id)
      .order("starts_at", { ascending: false }),
    admin
      .from("admin_notes")
      .select("id, body, created_at, admin_id")
      .eq("target_user_id", params.id)
      .order("created_at", { ascending: false }),
    admin
      .from("admin_audit_logs")
      .select("id, admin_id, action, target_type, target_id, details, created_at")
      .or(`target_id.eq.${params.id},admin_id.eq.${params.id}`)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("seller_user_id", params.id),
    admin
      .from("seller_wallets")
      .select("balance_paise, last_low_balance_alert_at")
      .eq("seller_user_id", params.id)
      .maybeSingle(),
    admin
      .from("seller_gateway_config")
      .select("gateway_type, is_active, is_verified")
      .eq("seller_user_id", params.id)
      .maybeSingle(),
  ]);

  if (!profile) notFound();

  const planKey = (profile.subscription_plan ?? "free") as keyof typeof PLANS;
  const planEntry =
    (PLANS as Record<string, { name: string; price: number }>)[planKey] ??
    PLANS.free;

  return (
    <div className="space-y-6">
      {/* ── Back link ──────────────────────────────────────────────── */}
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      {/* ── Hero banner — colourful, per-user gradient ─────────────── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl bg-gradient-to-br p-6 text-white shadow-card-lg ring-1 ring-white/15 animate-in-up sm:p-8",
          gradientFor(profile.email ?? ""),
        )}
        style={{ animationDelay: "0ms" }}
      >
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/4 h-44 w-44 rounded-full bg-black/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg font-bold text-white ring-2 ring-inset ring-white/30 backdrop-blur-sm"
          >
            {initials(profile.full_name ?? profile.email ?? "?")}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
              Seller profile
            </p>
            <h1 className="truncate font-sora text-2xl font-bold tracking-tight drop-shadow-sm sm:text-3xl">
              {profile.full_name ?? profile.email}
            </h1>
            <p className="truncate text-sm text-white/80">{profile.email}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <HeroChip icon={CreditCard}>{planEntry.name}</HeroChip>
              <HeroChip>
                {(profile.subscription_status ?? "inactive").replace(/_/g, " ")}
              </HeroChip>
              {profile.suspended_at && (
                <HeroChip className="bg-rose-500/40 ring-rose-200/40">
                  Suspended
                </HeroChip>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Action toolbar ─────────────────────────────────────────── */}
      <div
        className="flex flex-wrap justify-end gap-2 animate-in-up"
        style={{ animationDelay: "60ms" }}
      >
        <UserActions
          userId={profile.id}
          userEmail={profile.email}
          currentPlan={profile.subscription_plan ?? "free"}
          suspended={!!profile.suspended_at}
        />
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-2 gap-3 animate-in-up lg:grid-cols-4"
        style={{ animationDelay: "80ms" }}
      >
        <DetailStat label="Lifetime Revenue" value={rupees(Number(profile.total_revenue ?? 0))} tile="tile-emerald" icon={IndianRupee} />
        <DetailStat label="Orders" value={(totalOrders ?? 0).toLocaleString("en-IN")} tile="tile-indigo" icon={Receipt} />
        <DetailStat label="Pages" value={(pages?.length ?? 0).toLocaleString("en-IN")} tile="tile-violet" icon={FileText} />
        <DetailStat label="Wallet" value={formatINR(Number(walletRow?.balance_paise ?? 0))} tile="tile-amber" icon={Wallet} />
      </div>

      {/* Suspended banner */}
      {profile.suspended_at && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 animate-in-up dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Account suspended</p>
            <p className="mt-1">
              {profile.suspended_reason ?? "No reason provided"} ·{" "}
              {formatDate(profile.suspended_at)}
            </p>
          </div>
        </div>
      )}

      {/* ── Two-column body: profile card (left) + tabs (right) ─────── */}
      <div
        className="grid gap-6 animate-in-up lg:grid-cols-[320px_minmax(0,1fr)]"
        style={{ animationDelay: "100ms" }}
      >
        {/* LEFT — profile summary card */}
        <aside className="space-y-4">
          <div className="card-surface p-5">
            <h2 className="font-sora text-base font-semibold tracking-tight">
              Profile
            </h2>

            <div className="mt-4 space-y-3 text-sm">
              <ProfileLine icon={Mail} label="Email" value={profile.email} />
              <ProfileLine
                icon={Phone}
                label="Phone"
                value={profile.phone ?? "—"}
              />
              <ProfileLine
                icon={Calendar}
                label="Joined"
                value={formatDate(profile.created_at)}
              />
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Plan
              </p>
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    PLAN_BADGE[planKey] ?? PLAN_BADGE.free,
                  )}
                >
                  {planEntry.name}
                </span>
                <StatusBadge status={profile.subscription_status ?? "inactive"} />
              </div>
              {planEntry.price > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  ₹{planEntry.price.toLocaleString("en-IN")}/month
                </p>
              )}
            </div>

            <div className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
              <ProfileLine
                icon={Wallet}
                label="Lifetime revenue"
                value={rupees(Number(profile.total_revenue ?? 0))}
                mono
              />
              <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Wallet &amp; gateway
              </p>
              <ProfileLine
                icon={Wallet}
                label="Wallet balance"
                value={formatINR(Number(walletRow?.balance_paise ?? 0))}
                mono
              />
              <ProfileLine
                icon={CreditCard}
                label="Gateway"
                value={
                  gatewayRow
                    ? `${gatewayRow.gateway_type}${gatewayRow.is_verified ? " · verified" : " · unverified"}${gatewayRow.is_active ? "" : " · inactive"}`
                    : "Not connected"
                }
              />
              <Link
                href="/admin/seller-wallets"
                className="inline-block text-xs font-medium text-primary hover:underline"
              >
                Manage wallet →
              </Link>
            </div>
          </div>

          {/* Admin notes side card */}
          <div className="card-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-sora text-base font-semibold tracking-tight">
                Admin notes
              </h2>
              <span className="text-xs text-muted-foreground">
                {notes?.length ?? 0}
              </span>
            </div>
            {(notes ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No notes yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {(notes ?? []).map((n) => (
                  <li
                    key={n.id}
                    className="rounded-lg border border-border bg-muted/20 p-3"
                  >
                    <p className="whitespace-pre-wrap text-foreground">
                      {n.body}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(n.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* RIGHT — tabs */}
        <Tabs defaultValue="transactions" className="min-w-0">
          <TabsList className="mb-4 inline-flex h-auto bg-transparent p-0">
            <DataTab value="transactions" count={orders?.length ?? 0}>
              Transactions
            </DataTab>
            <DataTab value="pages" count={pages?.length ?? 0}>
              Pages
            </DataTab>
            <DataTab value="audit" count={auditTrail?.length ?? 0}>
              Audit Trail
            </DataTab>
          </TabsList>

          {/* ── Transactions tab ────────────────────────────────── */}
          <TabsContent value="transactions" className="mt-0">
            <DataCard
              title="Recent orders"
              subtitle={`${orders?.length ?? 0} most recent`}
            >
              {(orders ?? []).length === 0 ? (
                <EmptyData label="No orders yet" />
              ) : (
                <DataTable>
                  <thead className="bg-muted/40">
                    <tr className="text-left">
                      <Th>Buyer</Th>
                      <Th className="text-right">Amount</Th>
                      <Th>Status</Th>
                      <Th>Date</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(orders ?? []).map((o) => (
                      <tr
                        key={o.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {o.buyer_name ?? o.buyer_email}
                          </div>
                          {o.buyer_name && (
                            <div className="text-xs text-muted-foreground">
                              {o.buyer_email}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                          {rupees(Number(o.amount ?? 0))}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatDateTime(o.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </DataCard>

            {(subs ?? []).length > 0 && (
              <div className="mt-4">
                <DataCard
                  title="Subscription history"
                  subtitle={`${subs?.length ?? 0} entries`}
                >
                  <DataTable>
                    <thead className="bg-muted/40">
                      <tr className="text-left">
                        <Th>Plan</Th>
                        <Th>Status</Th>
                        <Th className="text-right">Amount</Th>
                        <Th>Started</Th>
                        <Th>Ended</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(subs ?? []).map((s) => (
                        <tr
                          key={s.id}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <td className="px-4 py-3 capitalize font-medium">
                            {s.plan}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={s.status ?? "active"} />
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm">
                            {s.amount
                              ? `₹${Number(s.amount).toLocaleString("en-IN")}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {s.starts_at ? formatDate(s.starts_at) : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {s.cancelled_at
                              ? formatDate(s.cancelled_at)
                              : s.ends_at
                                ? formatDate(s.ends_at)
                                : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                </DataCard>
              </div>
            )}
          </TabsContent>

          {/* ── Pages tab ───────────────────────────────────────── */}
          <TabsContent value="pages" className="mt-0">
            <DataCard
              title="Published pages"
              subtitle={`${pages?.length ?? 0} total`}
            >
              {(pages ?? []).length === 0 ? (
                <EmptyData label="No pages yet" />
              ) : (
                <DataTable>
                  <thead className="bg-muted/40">
                    <tr className="text-left">
                      <Th>Title</Th>
                      <Th>Type</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Views</Th>
                      <Th className="text-right">Revenue</Th>
                      <Th>Created</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(pages ?? []).map((p) => (
                      <tr
                        key={p.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={publicPagePath(p.type, p.slug, (p as { template_id?: string | null }).template_id)}
                            target="_blank"
                            className="font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {p.title}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {publicPagePath(p.type, p.slug, (p as { template_id?: string | null }).template_id)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs capitalize">
                            {p.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {Number(p.view_count ?? 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm">
                          {rupees(Number(p.total_revenue ?? 0))}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatDate(p.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </DataCard>
          </TabsContent>

          {/* ── Audit trail tab ─────────────────────────────────── */}
          <TabsContent value="audit" className="mt-0">
            <DataCard
              title="Audit trail"
              subtitle={`${auditTrail?.length ?? 0} entries — newest first`}
            >
              {(auditTrail ?? []).length === 0 ? (
                <EmptyData label="No audit entries yet" />
              ) : (
                <ol className="relative space-y-3 px-5 py-5">
                  <span
                    aria-hidden
                    className="absolute left-[18px] top-7 bottom-7 w-px bg-border"
                  />
                  {(auditTrail ?? []).map((a) => (
                    <li key={a.id} className="relative pl-6 text-sm">
                      <span
                        aria-hidden
                        className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-indigo-500 shadow-sm"
                      />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                            {a.action}
                          </code>
                          {a.target_type && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              on {a.target_type}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDateTime(a.created_at)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </DataCard>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function HeroChip({
  icon: Icon,
  className,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium capitalize text-white ring-1 ring-inset ring-white/20",
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

function DetailStat({
  label,
  value,
  tile,
  icon: Icon,
}: {
  label: string;
  value: string;
  tile: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="card-surface flex items-center gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-md">
      <span
        aria-hidden
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          tile,
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 font-sora text-lg font-bold tabular-nums text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

function ProfileLine({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <span
        className={cn(
          "max-w-[60%] truncate text-right text-sm",
          mono && "font-mono text-xs",
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function DataTab({
  value,
  count,
  children,
}: {
  value: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "rounded-lg border border-transparent px-3 py-1.5 text-sm",
        "data-[state=active]:border-border data-[state=active]:bg-card",
        "data-[state=active]:font-semibold data-[state=active]:shadow-sm",
      )}
    >
      {children}
      <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
        {count}
      </span>
    </TabsTrigger>
  );
}

function DataCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="font-sora text-base font-semibold tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

function EmptyData({ label }: { label: string }) {
  return (
    <p className="px-6 py-10 text-center text-sm text-muted-foreground">
      {label}
    </p>
  );
}

