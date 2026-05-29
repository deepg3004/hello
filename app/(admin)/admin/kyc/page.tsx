import Link from "next/link";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { KycReviewActions } from "@/components/admin/KycReviewActions";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Admin · KYC Queue" };

interface KycRow {
  id: string;
  user_id: string;
  level: number | null;
  status: string;
  pan_number: string | null;
  pan_name: string | null;
  pan_verified_at: string | null;
  bank_verified_at: string | null;
  selfie_url: string | null;
  id_document_url: string | null;
  risk_flags: unknown;
  created_at: string;
  user_profiles: { full_name: string | null; email: string; phone: string | null; bank_account_number: string | null; bank_ifsc: string | null; bank_holder_name: string | null } |
    { full_name: string | null; email: string; phone: string | null; bank_account_number: string | null; bank_ifsc: string | null; bank_holder_name: string | null }[] | null;
}

export default async function AdminKycQueuePage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("kyc_submissions")
    .select(
      "id, user_id, level, status, pan_number, pan_name, pan_verified_at, bank_verified_at, selfie_url, id_document_url, risk_flags, created_at, user_profiles(full_name, email, phone, bank_account_number, bank_ifsc, bank_holder_name)",
    )
    .in("status", ["pending", "under_review"])
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as unknown as KycRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">KYC queue</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} submission{rows.length === 1 ? "" : "s"} awaiting review.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 p-12 text-center text-sm text-muted-foreground">
          Inbox zero. No KYC submissions to review.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const profile = Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles;
            const riskFlags = Array.isArray(r.risk_flags)
              ? (r.risk_flags as string[])
              : [];
            return (
              <Card key={r.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">
                      <Link href={`/admin/users/${r.user_id}`} className="hover:underline">
                        {profile?.full_name ?? profile?.email ?? "(unknown user)"}
                      </Link>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{profile?.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Submitted {format(new Date(r.created_at), "d MMM yyyy, HH:mm")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Level {r.level ?? 0}</Badge>
                    <StatusBadge status={r.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Block label="PAN">
                      <KV k="Number" v={r.pan_number ?? "—"} mono />
                      <KV k="Name" v={r.pan_name ?? "—"} />
                      <KV k="Verified" v={r.pan_verified_at ? "Yes" : "No"} />
                    </Block>
                    <Block label="Bank">
                      <KV k="Holder" v={profile?.bank_holder_name ?? "—"} />
                      <KV k="Account" v={profile?.bank_account_number ?? "—"} mono />
                      <KV k="IFSC" v={profile?.bank_ifsc ?? "—"} mono />
                      <KV k="Verified" v={r.bank_verified_at ? "Yes" : "No"} />
                    </Block>
                  </div>
                  {riskFlags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {riskFlags.map((f, i) => (
                        <Badge key={i} variant="outline" className="bg-amber-100 text-amber-800">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    {r.selfie_url && (
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                          Selfie
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.selfie_url}
                          alt="selfie"
                          className="aspect-video w-full rounded-md border object-cover"
                        />
                      </div>
                    )}
                    {r.id_document_url && (
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                          ID document
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.id_document_url}
                          alt="ID"
                          className="aspect-video w-full rounded-md border object-cover"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <KycReviewActions submissionId={r.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <dl className="space-y-1">{children}</dl>
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={mono ? "font-mono text-xs text-right" : "text-right"}>{v}</dd>
    </div>
  );
}
