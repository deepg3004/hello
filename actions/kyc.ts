"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  aadhaarOtpStart,
  aadhaarOtpVerify,
  bankPennyDrop,
  last4,
  maskLast4,
  verifyPan,
  type SurepassResult,
} from "@/lib/kyc/surepass";
import { nameSimilarity } from "@/lib/kyc/fuzzy";
import { writeAuditLog } from "@/lib/admin/audit";
import { notifyKyc } from "@/lib/notifications/events";

export interface ActionResult {
  ok: boolean;
  message?: string;
  linked_account_id?: string;
  /** Free-form data the UI may surface (e.g. PAN holder name). */
  data?: Record<string, unknown>;
}

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const NAME_MATCH_THRESHOLD = 0.75;

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

async function getAuthedUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Get the user's single KYC submission row, creating an empty one if missing.
 * Returns the submission id + the joined profile.
 */
async function ensureSubmission(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const { data: existing } = await admin
    .from("kyc_submissions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing;

  const { data: inserted } = await admin
    .from("kyc_submissions")
    .insert({ user_id: userId, status: "pending" })
    .select("*")
    .single();
  return inserted;
}

interface LogRow {
  kind: "pan" | "bank" | "aadhaar_otp" | "aadhaar_verify" | "document" | "gst" | "business_reg";
  request_summary: Record<string, unknown>;
  response_summary: Record<string, unknown>;
  success: boolean;
  error_message?: string;
  http_status?: number;
  duration_ms?: number;
}

async function logVerification(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  submissionId: string | null,
  row: LogRow,
) {
  await admin.from("kyc_verification_logs").insert({
    user_id: userId,
    submission_id: submissionId,
    ...row,
  });
}

/**
 * If a paid-tier KYC item is approved and Level 2 is now complete, bump the
 * user_profiles row to kyc_level=2 and enable payouts. Returns true if the
 * promotion happened.
 */
async function maybePromoteToLevel2(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  panOk: boolean,
  bankOk: boolean,
  selfieUploaded: boolean,
): Promise<boolean> {
  if (!(panOk && bankOk && selfieUploaded)) return false;
  await admin
    .from("user_profiles")
    .update({
      kyc_level: 2,
      pan_verified: true,
      bank_verified: true,
      payouts_enabled: true,
    })
    .eq("id", userId);
  await admin
    .from("kyc_submissions")
    .update({ status: "approved", level: 2, reviewed_at: new Date().toISOString() })
    .eq("user_id", userId);
  return true;
}

// ----------------------------------------------------------------------------
// PAN
// ----------------------------------------------------------------------------

export async function submitPanVerificationAction(
  pan_number_raw: string,
): Promise<ActionResult> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const pan = pan_number_raw.trim().toUpperCase();
  if (!PAN_RE.test(pan)) {
    return { ok: false, message: "Invalid PAN format (5 letters + 4 digits + 1 letter)." };
  }

  const admin = createAdminClient();
  const submission = await ensureSubmission(admin, user.id);
  const submissionId = submission?.id ?? null;

  // Increment attempts
  await admin
    .from("kyc_submissions")
    .update({ pan_attempts: (submission?.pan_attempts ?? 0) + 1 })
    .eq("user_id", user.id);

  const result = await verifyPan(pan);

  await logVerification(admin, user.id, submissionId, {
    kind: "pan",
    request_summary: { pan: maskLast4(pan) },
    response_summary: {
      status_code: result.status_code,
      message: result.message,
      full_name: result.data?.full_name,
    },
    success: result.ok && !!result.data?.full_name,
    error_message: result.ok ? undefined : result.message,
    http_status: result.http_status,
    duration_ms: result.duration_ms,
  });

  if (result.not_configured) {
    return { ok: false, message: result.message };
  }
  if (!result.ok || !result.data?.full_name) {
    return {
      ok: false,
      message: result.message ?? "PAN could not be verified. Check the number and try again.",
    };
  }

  const panName = result.data.full_name;

  // Duplicate-PAN fraud check.
  const { data: panDupes } = await admin
    .from("kyc_submissions")
    .select("user_id")
    .eq("pan_number", pan)
    .neq("user_id", user.id);
  const dupeFlag = (panDupes?.length ?? 0) > 0;

  const riskFlags = Array.isArray(submission?.risk_flags)
    ? new Set(submission!.risk_flags as string[])
    : new Set<string>();
  if (dupeFlag) riskFlags.add("duplicate_pan");

  await admin
    .from("kyc_submissions")
    .update({
      pan_number: pan,
      pan_name: panName,
      pan_verified_at: new Date().toISOString(),
      risk_flags: Array.from(riskFlags),
      status: dupeFlag ? "under_review" : submission?.status ?? "pending",
    })
    .eq("user_id", user.id);

  if (dupeFlag) {
    await writeAuditLog({
      admin_id: user.id,
      action: "kyc.risk_flag_added",
      target_type: "kyc_submission",
      target_id: submissionId ?? undefined,
      details: { flag: "duplicate_pan" },
    });
    await notifyKyc(
      { userId: user.id, kind: "flagged", flags: ["duplicate_pan"] },
      admin,
    );
  }

  // Persist PAN on the profile too.
  await admin
    .from("user_profiles")
    .update({ pan_number: pan, pan_verified: !dupeFlag })
    .eq("id", user.id);

  revalidatePath("/dashboard/kyc");
  return {
    ok: true,
    data: { full_name: panName, duplicate: dupeFlag },
    message: dupeFlag ? "PAN verified, but flagged for manual review." : "PAN verified.",
  };
}

// ----------------------------------------------------------------------------
// Manual KYC submission — fallback when automated verification (Surepass) is
// unavailable or fails. Captures PAN + bank details and queues the submission
// for an admin to verify by hand (no auto-verify flags are set here).
// ----------------------------------------------------------------------------

export async function submitManualKycAction(input: {
  pan_number: string;
  pan_name: string;
  account_number: string;
  ifsc: string;
  bank_holder_name: string;
  aadhaar_number?: string;
}): Promise<ActionResult> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const pan = input.pan_number.trim().toUpperCase();
  const ifsc = input.ifsc.trim().toUpperCase();
  const account = input.account_number.replace(/\s+/g, "");
  const panName = input.pan_name.trim();
  const holder = input.bank_holder_name.trim();
  const aadhaar = (input.aadhaar_number ?? "").replace(/\D/g, "");

  if (!PAN_RE.test(pan)) {
    return { ok: false, message: "Invalid PAN format (5 letters + 4 digits + 1 letter)." };
  }
  if (!panName) return { ok: false, message: "Enter the name printed on your PAN card." };
  if (!/^[0-9]{6,18}$/.test(account)) {
    return { ok: false, message: "Account number should be 6–18 digits." };
  }
  if (!IFSC_RE.test(ifsc)) return { ok: false, message: "Invalid IFSC code." };
  if (!holder) return { ok: false, message: "Enter the bank account holder name." };
  if (aadhaar && aadhaar.length !== 12) {
    return { ok: false, message: "Aadhaar number should be 12 digits." };
  }

  const admin = createAdminClient();
  const submission = await ensureSubmission(admin, user.id);
  const submissionId = submission?.id ?? null;

  const riskFlags = Array.isArray(submission?.risk_flags)
    ? new Set(submission!.risk_flags as string[])
    : new Set<string>();
  riskFlags.add("manual_submission");

  // Store the details but DO NOT set pan_verified/bank_verified — an admin
  // approves via the KYC queue / manual-verify control.
  await admin
    .from("kyc_submissions")
    .update({
      pan_number: pan,
      pan_name: panName,
      level: 2,
      status: "under_review",
      risk_flags: Array.from(riskFlags),
    })
    .eq("user_id", user.id);

  await admin
    .from("user_profiles")
    .update({
      pan_number: pan,
      bank_account_number: account,
      bank_ifsc: ifsc,
      bank_holder_name: holder,
    })
    .eq("id", user.id);

  // Aadhaar number is stored best-effort — the column ships in migration 036,
  // so a missing column (pre-migration) must not fail the whole submission.
  if (aadhaar) {
    const { error: aadhaarErr } = await admin
      .from("kyc_submissions")
      .update({ aadhaar_number: aadhaar })
      .eq("user_id", user.id);
    if (aadhaarErr) {
      // Swallow — likely the column doesn't exist yet. Submission still stands.
    }
  }

  await logVerification(admin, user.id, submissionId, {
    kind: "pan",
    request_summary: { pan: maskLast4(pan), manual: true },
    response_summary: { manual: true },
    success: false,
    error_message: "Manual submission — pending admin review",
  });

  await writeAuditLog({
    admin_id: user.id,
    action: "kyc.manual_submission",
    target_type: "kyc_submission",
    target_id: submissionId ?? undefined,
    details: { pan: maskLast4(pan) },
  });

  await notifyKyc(
    { userId: user.id, kind: "flagged", flags: ["manual_submission"] },
    admin,
  );

  revalidatePath("/dashboard/kyc");
  revalidatePath("/admin/kyc");
  return {
    ok: true,
    message: "Submitted for manual review. We'll verify within 1–2 business days.",
  };
}

// ----------------------------------------------------------------------------
// Bank (penny drop + fuzzy match against PAN name)
// ----------------------------------------------------------------------------

export async function submitBankVerificationAction(
  account_number_raw: string,
  ifsc_raw: string,
): Promise<ActionResult> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const account = account_number_raw.replace(/\s+/g, "");
  const ifsc = ifsc_raw.trim().toUpperCase();
  if (!/^[0-9]{6,18}$/.test(account)) {
    return { ok: false, message: "Account number should be 6–18 digits." };
  }
  if (!IFSC_RE.test(ifsc)) {
    return { ok: false, message: "IFSC code looks invalid (11 chars, e.g. HDFC0001234)." };
  }

  const admin = createAdminClient();
  const submission = await ensureSubmission(admin, user.id);
  const submissionId = submission?.id ?? null;

  await admin
    .from("kyc_submissions")
    .update({ bank_attempts: (submission?.bank_attempts ?? 0) + 1 })
    .eq("user_id", user.id);

  const result = await bankPennyDrop(account, ifsc);

  const returnedName = result.data?.full_name;

  await logVerification(admin, user.id, submissionId, {
    kind: "bank",
    request_summary: { account_last4: last4(account), ifsc },
    response_summary: {
      status_code: result.status_code,
      message: result.message,
      account_exists: result.data?.account_exists,
      full_name: returnedName,
    },
    success: result.ok && !!returnedName,
    error_message: result.ok ? undefined : result.message,
    http_status: result.http_status,
    duration_ms: result.duration_ms,
  });

  if (result.not_configured) {
    return { ok: false, message: result.message };
  }
  if (!result.ok || !returnedName) {
    return {
      ok: false,
      message:
        result.message ??
        "Bank account could not be verified. Double-check the number + IFSC.",
    };
  }

  // Fuzzy-match against PAN holder name (if we have one).
  const panName = submission?.pan_name ?? null;
  const similarity = panName ? nameSimilarity(panName, returnedName) : 0;
  const nameMatchOk = similarity >= NAME_MATCH_THRESHOLD;

  // Duplicate-bank fraud check.
  const { data: bankDupes } = await admin
    .from("kyc_submissions")
    .select("user_id")
    .eq("bank_account_number", account)
    .neq("user_id", user.id);
  const dupeFlag = (bankDupes?.length ?? 0) > 0;

  const riskFlags = Array.isArray(submission?.risk_flags)
    ? new Set(submission!.risk_flags as string[])
    : new Set<string>();
  if (dupeFlag) riskFlags.add("duplicate_bank_account");
  if (panName && !nameMatchOk) riskFlags.add("name_mismatch");

  const flagged = dupeFlag || (panName && !nameMatchOk);

  await admin
    .from("kyc_submissions")
    .update({
      bank_account_number: account,
      bank_ifsc: ifsc,
      bank_holder_name_returned: returnedName,
      bank_verified_at: flagged ? null : new Date().toISOString(),
      risk_flags: Array.from(riskFlags),
      status: flagged ? "under_review" : submission?.status ?? "pending",
    })
    .eq("user_id", user.id);

  await admin
    .from("user_profiles")
    .update({
      bank_account_number: account,
      bank_ifsc: ifsc,
      bank_holder_name: returnedName,
      bank_verified: !flagged,
    })
    .eq("id", user.id);

  if (dupeFlag) {
    await writeAuditLog({
      admin_id: user.id,
      action: "kyc.risk_flag_added",
      target_type: "kyc_submission",
      target_id: submissionId ?? undefined,
      details: { flag: "duplicate_bank_account" },
    });
  }

  revalidatePath("/dashboard/kyc");

  if (flagged) {
    const flags = [
      dupeFlag ? "duplicate_bank_account" : null,
      panName && !nameMatchOk ? "name_mismatch" : null,
    ].filter((f): f is string => !!f);
    await notifyKyc({ userId: user.id, kind: "flagged", flags }, admin);
    return {
      ok: true,
      data: { returned_name: returnedName, similarity, duplicate: dupeFlag },
      message: dupeFlag
        ? "Bank verified, but the account is already linked to another seller. Flagged for review."
        : `Bank verified, but the holder name didn't match your PAN (${Math.round(similarity * 100)}%). Flagged for review.`,
    };
  }

  // Auto-promote if PAN + selfie are also done.
  const { data: latest } = await admin
    .from("kyc_submissions")
    .select("pan_verified_at, selfie_url")
    .eq("user_id", user.id)
    .single();

  await maybePromoteToLevel2(
    admin,
    user.id,
    !!latest?.pan_verified_at,
    true,
    !!latest?.selfie_url,
  );

  return {
    ok: true,
    data: { returned_name: returnedName, similarity },
    message: "Bank account verified.",
  };
}

// ----------------------------------------------------------------------------
// Documents (selfie / ID / GST / business reg)
// ----------------------------------------------------------------------------

export type DocumentType =
  | "selfie"
  | "id_document"
  | "gst_certificate"
  | "business_registration"
  | "pan_front"
  | "pan_back"
  | "aadhaar_front"
  | "aadhaar_back"
  | "bank_statement"
  | "cancel_cheque";

const DOC_COLUMN: Record<DocumentType, string> = {
  selfie: "selfie_url",
  id_document: "id_document_url",
  gst_certificate: "gst_certificate_url",
  business_registration: "business_registration_url",
  // Manual-submission document slots (migration 036).
  pan_front: "pan_front_url",
  pan_back: "pan_back_url",
  aadhaar_front: "aadhaar_front_url",
  aadhaar_back: "aadhaar_back_url",
  bank_statement: "bank_statement_url",
  cancel_cheque: "cancel_cheque_url",
};

export async function uploadKycDocumentAction(formData: FormData): Promise<ActionResult> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const docType = (formData.get("documentType") ?? "") as DocumentType;
  const file = formData.get("file");
  if (!docType || !(docType in DOC_COLUMN)) {
    return { ok: false, message: "Unknown document type" };
  }
  if (!(file instanceof File)) {
    return { ok: false, message: "File is required" };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { ok: false, message: "File too large (20 MB max)" };
  }

  const admin = createAdminClient();
  await ensureSubmission(admin, user.id);

  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80);
  const path = `${user.id}/${docType}/${Date.now()}_${safeName}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from("kyc-documents").upload(path, buf, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (upErr) return { ok: false, message: upErr.message };

  const updateCol: Record<string, string> = {};
  updateCol[DOC_COLUMN[docType]] = path;
  await admin.from("kyc_submissions").update(updateCol).eq("user_id", user.id);

  await logVerification(admin, user.id, null, {
    kind: docType === "gst_certificate" ? "gst" : docType === "business_registration" ? "business_reg" : "document",
    request_summary: { document_type: docType, name: file.name, size: file.size },
    response_summary: { storage_path: path },
    success: true,
  });

  // Auto-promote if everything is in place.
  const { data: latest } = await admin
    .from("kyc_submissions")
    .select("pan_verified_at, bank_verified_at, selfie_url")
    .eq("user_id", user.id)
    .single();

  await maybePromoteToLevel2(
    admin,
    user.id,
    !!latest?.pan_verified_at,
    !!latest?.bank_verified_at,
    !!latest?.selfie_url,
  );

  revalidatePath("/dashboard/kyc");
  return { ok: true, data: { path } };
}

// ----------------------------------------------------------------------------
// Aadhaar OTP (Level 3)
// ----------------------------------------------------------------------------

export async function aadhaarStartAction(
  aadhaar_number_raw: string,
): Promise<ActionResult> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };
  const digits = aadhaar_number_raw.replace(/\s+/g, "");
  if (!/^[0-9]{12}$/.test(digits)) {
    return { ok: false, message: "Aadhaar must be 12 digits." };
  }
  const admin = createAdminClient();
  const submission = await ensureSubmission(admin, user.id);

  const result: SurepassResult<{ client_id: string }> = await aadhaarOtpStart(digits);
  await logVerification(admin, user.id, submission?.id ?? null, {
    kind: "aadhaar_otp",
    request_summary: { last4: last4(digits) },
    response_summary: {
      status_code: result.status_code,
      message: result.message,
      client_id: result.data?.client_id,
    },
    success: result.ok && !!result.data?.client_id,
    error_message: result.ok ? undefined : result.message,
    http_status: result.http_status,
    duration_ms: result.duration_ms,
  });

  if (result.not_configured) return { ok: false, message: result.message };
  if (!result.ok || !result.data?.client_id) {
    return { ok: false, message: result.message ?? "Couldn't send OTP." };
  }
  await admin
    .from("kyc_submissions")
    .update({
      aadhaar_last4: last4(digits),
      aadhaar_ref_id: result.data.client_id,
    })
    .eq("user_id", user.id);
  return { ok: true, data: { client_id: result.data.client_id } };
}

export async function aadhaarVerifyAction(otp: string): Promise<ActionResult> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };
  if (!/^[0-9]{4,8}$/.test(otp)) return { ok: false, message: "Invalid OTP." };

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("kyc_submissions")
    .select("id, aadhaar_ref_id")
    .eq("user_id", user.id)
    .single();
  if (!sub?.aadhaar_ref_id) {
    return { ok: false, message: "Start the OTP flow first." };
  }

  const result = await aadhaarOtpVerify(sub.aadhaar_ref_id, otp);
  await logVerification(admin, user.id, sub.id, {
    kind: "aadhaar_verify",
    request_summary: { client_id: sub.aadhaar_ref_id },
    response_summary: {
      status_code: result.status_code,
      message: result.message,
      full_name: result.data?.full_name,
    },
    success: result.ok && !!result.data?.full_name,
    error_message: result.ok ? undefined : result.message,
    http_status: result.http_status,
    duration_ms: result.duration_ms,
  });

  if (result.not_configured) return { ok: false, message: result.message };
  if (!result.ok || !result.data?.full_name) {
    return { ok: false, message: result.message ?? "OTP verification failed." };
  }

  await admin
    .from("kyc_submissions")
    .update({
      aadhaar_verified_at: new Date().toISOString(),
      level: 3,
    })
    .eq("id", sub.id);

  await admin.from("user_profiles").update({ kyc_level: 3 }).eq("id", user.id);

  revalidatePath("/dashboard/kyc");
  return { ok: true, data: { full_name: result.data.full_name } };
}

// ----------------------------------------------------------------------------
// Linked account (kept from before — unchanged signature)
// ----------------------------------------------------------------------------

export async function createLinkedAccountAction(): Promise<ActionResult> {
  const user = await getAuthedUser();
  if (!user) return { ok: false, message: "Not signed in" };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/kyc/create-linked-account`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: user.id }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    linked_account_id?: string;
    error?: string;
  };
  if (!res.ok || !json.linked_account_id) {
    return { ok: false, message: json.error ?? "Linked account creation failed" };
  }
  return { ok: true, linked_account_id: json.linked_account_id };
}
