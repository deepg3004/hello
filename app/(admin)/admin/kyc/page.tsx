import {
  KycReviewClient,
  type KycReviewItem,
} from "@/components/admin/KycReviewClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

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
      "id, user_id, level, status, pan_number, pan_name, pan_verified_at, bank_verified_at, selfie_url, id_document_url, risk_flags, rejection_reason, created_at, user_profiles!kyc_submissions_user_id_fkey(full_name, email, phone, bank_account_number, bank_ifsc, bank_holder_name)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const raw = (data ?? []) as unknown as RawKycRow[];

  // Manual-submission doc columns ship in migration 036 — fetch them in an
  // isolated query so a missing column can't break the whole queue.
  const extrasById = new Map<string, Record<string, string | null>>();
  try {
    const { data: extras } = await admin
      .from("kyc_submissions")
      .select(
        "id, aadhaar_number, pan_front_url, pan_back_url, aadhaar_front_url, aadhaar_back_url, bank_statement_url, cancel_cheque_url",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    for (const e of extras ?? []) {
      extrasById.set(e.id as string, e as Record<string, string | null>);
    }
  } catch {
    // Columns ship in migration 036; ignore until it's applied.
  }

  // Concurrently sign storage URLs + flatten the profile join. Limited to
  // the most recent 500 submissions so signing isn't unbounded.
  const items: KycReviewItem[] = await Promise.all(
    raw.map(async (r) => {
      const profile = Array.isArray(r.user_profiles)
        ? r.user_profiles[0]
        : r.user_profiles;
      const ex = extrasById.get(r.id) ?? {};
      const [
        selfie_url,
        id_document_url,
        pan_front_url,
        pan_back_url,
        aadhaar_front_url,
        aadhaar_back_url,
        bank_statement_url,
        cancel_cheque_url,
      ] = await Promise.all([
        signed(admin, r.selfie_url),
        signed(admin, r.id_document_url),
        signed(admin, ex.pan_front_url ?? null),
        signed(admin, ex.pan_back_url ?? null),
        signed(admin, ex.aadhaar_front_url ?? null),
        signed(admin, ex.aadhaar_back_url ?? null),
        signed(admin, ex.bank_statement_url ?? null),
        signed(admin, ex.cancel_cheque_url ?? null),
      ]);
      return {
        aadhaar_number: (ex.aadhaar_number as string) ?? null,
        pan_front_url,
        pan_back_url,
        aadhaar_front_url,
        aadhaar_back_url,
        bank_statement_url,
        cancel_cheque_url,
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
      <DashboardHero
        title="KYC queue"
        blurb={
          pendingCount === 0
            ? "Inbox zero. No submissions awaiting review."
            : `${pendingCount} submission${pendingCount === 1 ? "" : "s"} awaiting review.`
        }
        resourcesHref={null}
      />

      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <KycReviewClient items={items} />
      </div>
    </div>
  );
}
