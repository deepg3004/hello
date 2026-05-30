import { redirect } from "next/navigation";

import { KycWizard, type KycInitial } from "@/components/dashboard/kyc/KycWizard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">KYC verification</h1>
        <p className="text-sm text-muted-foreground">
          Verify your identity to unlock payouts. Each step uses live API checks
          — no manual review unless something looks off.
        </p>
      </div>
      <KycWizard initial={initial} />
    </div>
  );
}
