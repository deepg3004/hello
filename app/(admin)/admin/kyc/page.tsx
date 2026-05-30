import {
  KycReviewClient,
  type KycReviewItem,
} from "@/components/admin/KycReviewClient";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Admin · KYC Queue" };

interface RawKycRow {
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
  rejection_reason: string | null;
  created_at: string;
  user_profiles:
    | {
        full_name: string | null;
        email: string;
        phone: string | null;
        bank_account_number: string | null;
        bank_ifsc: string | null;
        bank_holder_name: string | null;
      }
    | {
        full_name: string | null;
        email: string;
        phone: string | null;
        bank_account_number: string | null;
        bank_ifsc: string | null;
        bank_holder_name: string | null;
      }[]
    | null;
}

/**
 * Sign a Supabase Storage object URL so the admin can preview the doc
 * inline without making the bucket public. Returns the original URL if it
 * already looks like a full http(s) URL (legacy data).
 */
async function signed(
  admin: ReturnType<typeof createAdminClient>,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await admin.storage
    .from("kyc-documents")
    .createSignedUrl(path, 15 * 60);
  return data?.signedUrl ?? null;
}

export default async function AdminKycQueuePage() {
  const admin = createAdminClient();

  // Pull every submission (all statuses) — the tabs filter client-side so
  // the admin can flip between Pending / Approved / Rejected without a
  // full server round-trip.
  const { data } = await admin
    .from("kyc_submissions")
    .select(
      "id, user_id, level, status, pan_number, pan_name, pan_verified_at, bank_verified_at, selfie_url, id_document_url, risk_flags, rejection_reason, created_at, user_profiles(full_name, email, phone, bank_account_number, bank_ifsc, bank_holder_name)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const raw = (data ?? []) as unknown as RawKycRow[];

  // Concurrently sign storage URLs + flatten the profile join. Limited to
  // the most recent 500 submissions so signing isn't unbounded.
  const items: KycReviewItem[] = await Promise.all(
    raw.map(async (r) => {
      const profile = Array.isArray(r.user_profiles)
        ? r.user_profiles[0]
        : r.user_profiles;
      const [selfie_url, id_document_url] = await Promise.all([
        signed(admin, r.selfie_url),
        signed(admin, r.id_document_url),
      ]);
      return {
        id: r.id,
        user_id: r.user_id,
        level: r.level,
        status: r.status,
        pan_number: r.pan_number,
        pan_name: r.pan_name,
        pan_verified_at: r.pan_verified_at,
        bank_verified_at: r.bank_verified_at,
        selfie_url,
        id_document_url,
        risk_flags: Array.isArray(r.risk_flags)
          ? (r.risk_flags as string[])
          : [],
        rejection_reason: r.rejection_reason,
        created_at: r.created_at,
        buyer_full_name: profile?.full_name ?? null,
        buyer_email: profile?.email ?? "",
        buyer_phone: profile?.phone ?? null,
        bank_account_number: profile?.bank_account_number ?? null,
        bank_ifsc: profile?.bank_ifsc ?? null,
        bank_holder_name: profile?.bank_holder_name ?? null,
      };
    }),
  );

  const pendingCount = items.filter(
    (i) => i.status === "pending" || i.status === "under_review",
  ).length;

  return (
    <div className="space-y-6">
      <div
        className="animate-in-up flex flex-wrap items-end justify-between gap-3"
        style={{ animationDelay: "0ms" }}
      >
        <div>
          <h1 className="font-sora text-2xl font-semibold tracking-tight">
            KYC queue
          </h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount === 0
              ? "Inbox zero. No submissions awaiting review."
              : `${pendingCount} submission${pendingCount === 1 ? "" : "s"} awaiting review.`}
          </p>
        </div>
      </div>

      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <KycReviewClient items={items} />
      </div>
    </div>
  );
}
