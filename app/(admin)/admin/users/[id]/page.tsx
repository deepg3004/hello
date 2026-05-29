import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { UserActions } from "@/components/admin/UserActions";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS } from "@/lib/plans";
import { formatINR } from "@/lib/utils";

export const metadata = { title: "Admin · User detail" };

const rupees = (n: number) => formatINR(n * 100);

export default async function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const admin = createAdminClient();
  const [{ data: profile }, { data: pages }, { data: orders }, { data: subs }, { data: notes }] =
    await Promise.all([
      admin
        .from("user_profiles")
        .select("*")
        .eq("id", params.id)
        .single(),
      admin
        .from("pages")
        .select("id, title, slug, status, type, view_count, total_revenue, created_at")
        .eq("user_id", params.id)
        .order("created_at", { ascending: false }),
      admin
        .from("orders")
        .select("id, buyer_email, amount, status, created_at")
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
    ]);

  if (!profile) notFound();

  const planName = (PLANS as Record<string, { name: string }>)[profile.subscription_plan ?? "free"]?.name ?? "Free";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            User
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile.full_name ?? profile.email}
          </h1>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
        <UserActions
          userId={profile.id}
          userEmail={profile.email}
          currentPlan={profile.subscription_plan ?? "free"}
          suspended={!!profile.suspended_at}
        />
      </div>

      {profile.suspended_at && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Account suspended</p>
            <p className="mt-1 text-muted-foreground">
              {profile.suspended_reason ?? "No reason provided"} ·{" "}
              {format(new Date(profile.suspended_at), "d MMM yyyy")}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row k="Phone" v={profile.phone ?? "—"} />
            <Row k="Plan" v={planName} />
            <Row k="Status" v={profile.subscription_status ?? "inactive"} />
            <Row k="KYC level" v={String(profile.kyc_level ?? 0)} />
            <Row k="PAN verified" v={profile.pan_verified ? "Yes" : "No"} />
            <Row k="Bank verified" v={profile.bank_verified ? "Yes" : "No"} />
            <Row k="Payouts enabled" v={profile.payouts_enabled ? "Yes" : "No"} />
            <Row k="Lifetime revenue" v={rupees(Number(profile.total_revenue ?? 0))} />
            <Row k="Joined" v={format(new Date(profile.created_at), "d MMM yyyy")} />
            <Row k="Razorpay linked acc" v={profile.razorpay_linked_account_id ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin notes ({notes?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {(notes ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {(notes ?? []).map((n) => (
                  <li key={n.id} className="rounded-md border bg-muted/30 p-3">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(n.created_at), "d MMM yyyy, HH:mm")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Pages ({pages?.length ?? 0})</CardTitle>
          <Link href="/admin/pages" className="text-xs text-muted-foreground hover:underline">
            All pages
          </Link>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {(pages ?? []).length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No pages yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pages ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/p/${p.slug}`} target="_blank" className="font-medium hover:underline">
                        {p.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{p.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(p.view_count ?? 0).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {rupees(Number(p.total_revenue ?? 0))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(p.created_at), "d MMM yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent orders ({orders?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {(orders ?? []).length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(orders ?? []).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{o.buyer_email}</TableCell>
                    <TableCell className="text-right font-mono">
                      {rupees(Number(o.amount ?? 0))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(o.created_at), "d MMM yyyy, HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscription history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {(subs ?? []).length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No subscription history.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(subs ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="capitalize">{s.plan}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status ?? "active"} />
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {s.amount ? `₹${Number(s.amount).toLocaleString("en-IN")}` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.starts_at ? format(new Date(s.starts_at), "d MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.cancelled_at
                        ? format(new Date(s.cancelled_at), "d MMM yyyy")
                        : s.ends_at
                          ? format(new Date(s.ends_at), "d MMM yyyy")
                          : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}
