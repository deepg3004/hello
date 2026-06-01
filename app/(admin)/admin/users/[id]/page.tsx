import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  Check,
  CreditCard,
  Mail,
  Phone,
  ShieldCheck,
  Wallet,
  X,
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
import { PLANS } from "@/lib/plans";
import { cn, formatDate, formatDateTime, formatINR } from "@/lib/utils";

export const metadata = { title: "Admin · User detail" };

const rupees = (n: number) => formatINR(n * 100);

// Plan badge palette — shared with UsersTable
const PLAN_BADGE: Record<string, string> = {
  free: "bg-zinc-100 text-zinc-700 border-zinc-200",
  starter: "bg-sky-50 text-sky-700 border-sky-200",
  pro: "bg-indigo-50 text-indigo-700 border-indigo-200",
  business: "bg-amber-50 text-amber-700 border-amber-200",
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
    { data: kyc },
    { data: auditTrail },
  ] = await Promise.all([
    admin.from("user_profiles").select("*").eq("id", params.id).single(),
    admin
      .from("pages")
      .select(
        "id, title, slug, status, type, view_count, total_revenue, created_at",
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
      .from("kyc_submissions")
      .select(
        "id, level, status, pan_number, pan_name, pan_verified_at, bank_verified_at, selfie_url, id_document_url, gst_certificate_url, aadhaar_verified_at, rejection_reason, created_at",
      )
      .eq("user_id", params.id)
      .order("created_at", { ascending: false }),
    admin
      .from("admin_audit_logs")
      .select("id, admin_id, action, target_type, target_id, details, created_at")
      .or(`target_id.eq.${params.id},admin_id.eq.${params.id}`)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (!profile) notFound();

  const planKey = (profile.subscription_plan ?? "free") as keyof typeof PLANS;
  const planEntry =
    (PLANS as Record<string, { name: string; price: number }>)[planKey] ??
    PLANS.free;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-start justify-between gap-3 animate-in-up"
        style={{ animationDelay: "0ms" }}
      >
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-full",
              "bg-gradient-to-br text-base font-semibold text-white shadow-md",
              gradientFor(profile.email ?? ""),
            )}
          >
            {initials(profile.full_name ?? profile.email ?? "?")}
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              User detail
            </p>
            <h1 className="font-sora text-2xl font-semibold tracking-tight">
              {profile.full_name ?? profile.email}
            </h1>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
        </div>
        <UserActions
          userId={profile.id}
          userEmail={profile.email}
          currentPlan={profile.subscription_plan ?? "free"}
          suspended={!!profile.suspended_at}
          kycVerified={
            !!profile.payouts_enabled || Number(profile.kyc_level ?? 0) >= 2
          }
        />
      </div>

      {/* Suspended banner */}
      {profile.suspended_at && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 animate-in-up">
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

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
              <KycBlock level={Number(profile.kyc_level ?? 0)} />
              <BankBlock verified={!!profile.bank_verified} />
            </div>

            <div className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
              <ProfileLine
                icon={Wallet}
                label="Lifetime revenue"
                value={rupees(Number(profile.total_revenue ?? 0))}
                mono
              />
              <ProfileLine
                icon={CreditCard}
                label="Razorpay linked acc"
                value={profile.razorpay_linked_account_id ?? "—"}
                mono
              />
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
            <DataTab value="kyc" count={kyc?.length ?? 0}>
              KYC Documents
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
                            href={`/p/${p.slug}`}
                            target="_blank"
                            className="font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {p.title}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            /p/{p.slug}
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

          {/* ── KYC documents tab ───────────────────────────────── */}
          <TabsContent value="kyc" className="mt-0">
            <DataCard
              title="KYC submissions"
              subtitle={`${kyc?.length ?? 0} on file`}
            >
              {(kyc ?? []).length === 0 ? (
                <EmptyData label="No KYC submissions yet" />
              ) : (
                <ul className="divide-y divide-border">
                  {(kyc ?? []).map((k) => (
                    <li key={k.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-sora font-semibold">
                              Level {k.level ?? 0}
                            </span>
                            <StatusBadge status={k.status} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Submitted {formatDateTime(k.created_at)}
                          </p>
                          {k.rejection_reason && (
                            <p className="mt-1 text-xs text-rose-700">
                              Rejection reason: {k.rejection_reason}
                            </p>
                          )}
                        </div>
                        <Link
                          href={`/admin/kyc?id=${k.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Review →
                        </Link>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <DocChip ok={!!k.pan_verified_at} label="PAN" />
                        <DocChip ok={!!k.bank_verified_at} label="Bank" />
                        <DocChip ok={!!k.selfie_url} label="Selfie" />
                        <DocChip ok={!!k.id_document_url} label="ID" />
                        <DocChip
                          ok={!!k.aadhaar_verified_at}
                          label="Aadhaar"
                        />
                        <DocChip ok={!!k.gst_certificate_url} label="GST" />
                      </div>
                    </li>
                  ))}
                </ul>
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
                        className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-indigo-500 shadow-sm"
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

function KycBlock({ level }: { level: number }) {
  const lvl = Math.max(0, Math.min(3, level));
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        KYC level
      </p>
      <div className="mt-1.5 flex items-center gap-1.5">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-2 w-2 rounded-full",
              i <= lvl
                ? lvl === 3
                  ? "bg-emerald-500"
                  : "bg-indigo-500"
                : "bg-muted",
            )}
          />
        ))}
        <span className="ml-1 font-mono text-sm font-semibold">L{lvl}</span>
      </div>
    </div>
  );
}

function BankBlock({ verified }: { verified: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        verified
          ? "border-emerald-200 bg-emerald-50"
          : "border-border bg-muted/20",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-widest",
          verified ? "text-emerald-700" : "text-muted-foreground",
        )}
      >
        Bank
      </p>
      <div
        className={cn(
          "mt-1.5 inline-flex items-center gap-1 text-sm font-semibold",
          verified ? "text-emerald-700" : "text-muted-foreground",
        )}
      >
        {verified ? (
          <>
            <Check className="h-3.5 w-3.5" /> Verified
          </>
        ) : (
          <>
            <X className="h-3.5 w-3.5" /> Pending
          </>
        )}
      </div>
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

function DocChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-border bg-muted/30 text-muted-foreground",
      )}
    >
      {ok ? (
        <Check className="h-3 w-3" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
      )}
      {label}
    </span>
  );
}
