import { redirect } from "next/navigation";

import { KycWizard, type KycInitial } from "@/components/dashboard/kyc/KycWizard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DashboardHero } from "@/components/dashboard/DashboardHero";

export const metadata = { title: "KYC" };

export default async function KycPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [{ data: profile }, { data: submission }] = await Promise.all([
    admin
      .from("user_profiles")
      .select(
        "email, phone, kyc_level, pan_verified, bank_verified, bank_holder_name",
      )
      .eq("id", user.id)
      .single(),
    admin
      .from("kyc_submissions")
      .select(
        "status, level, pan_name, bank_holder_name_returned, selfie_url, id_document_url, gst_certificate_url, aadhaar_verified_at, rejection_reason, risk_flags",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  // Manual-submission doc slots live in migration 036. Fetch them in an
  // isolated query so a missing column (before the migration is applied) just
  // yields nulls instead of breaking the whole page.
  const manualDocs = {
    panFront: false,
    panBack: false,
    aadhaarFront: false,
    aadhaarBack: false,
    bankStatement: false,
    cancelCheque: false,
  };
  let aadhaarOnFile = false;
  const { data: md } = await admin
    .from("kyc_submissions")
    .select(
      "pan_front_url, pan_back_url, aadhaar_front_url, aadhaar_back_url, bank_statement_url, cancel_cheque_url, aadhaar_number",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  if (md) {
    manualDocs.panFront = !!md.pan_front_url;
    manualDocs.panBack = !!md.pan_back_url;
    manualDocs.aadhaarFront = !!md.aadhaar_front_url;
    manualDocs.aadhaarBack = !!md.aadhaar_back_url;
    manualDocs.bankStatement = !!md.bank_statement_url;
    manualDocs.cancelCheque = !!md.cancel_cheque_url;
    aadhaarOnFile = !!md.aadhaar_number;
  }

  const initial: KycInitial = {
    email: profile?.email ?? user.email ?? "",
    phone: profile?.phone ?? null,
    emailConfirmed: !!user.email_confirmed_at,
    kycLevel: Number(profile?.kyc_level ?? 0),
    panVerified: !!profile?.pan_verified,
    panName: submission?.pan_name ?? null,
    bankVerified: !!profile?.bank_verified,
    bankHolderName:
      submission?.bank_holder_name_returned ??
      profile?.bank_holder_name ??
      null,
    selfieUploaded: !!submission?.selfie_url,
    idUploaded: !!submission?.id_document_url,
    aadhaarVerified: !!submission?.aadhaar_verified_at,
    gstUploaded: !!submission?.gst_certificate_url,
    status: (submission?.status ?? "pending") as KycInitial["status"],
    rejectionReason: submission?.rejection_reason ?? null,
    riskFlags: Array.isArray(submission?.risk_flags)
      ? (submission!.risk_flags as string[])
      : [],
    manualDocs,
    aadhaarOnFile,
  };

  return (
    <div className="space-y-6">
      <DashboardHero
        title="KYC verification"
        gradient="from-blue-600 via-indigo-600 to-violet-600"
        blurb="Verify your identity to unlock payouts. Each step uses live API checks — no manual review unless something looks off."
      />
      <div className="animate-in-up" style={{ animationDelay: "100ms" }}>
        <KycWizard initial={initial} />
      </div>
    </div>
  );
}
