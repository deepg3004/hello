// =============================================================================
// Surepass KYC API client.
//
// Wraps:
//   POST /api/v1/pan/pan-comprehensive   (PAN holder name verification)
//   POST /api/v1/bank-verification/      (penny-drop bank account verification)
//   POST /api/v1/aadhaar-v2/generate-otp (Aadhaar e-KYC step 1)
//   POST /api/v1/aadhaar-v2/submit-otp   (Aadhaar e-KYC step 2)
//
// Token comes from env (SUREPASS_TOKEN). If unset, the wrapper returns a
// configured-failure response — callers must NOT auto-approve in that case.
// =============================================================================

const DEFAULT_BASE = "https://kyc-api.surepass.io";

function getToken(): string | null {
  return process.env.SUREPASS_TOKEN || null;
}

function getBase(): string {
  return process.env.SUREPASS_BASE_URL || DEFAULT_BASE;
}

export interface SurepassResult<T = unknown> {
  ok: boolean;
  http_status?: number;
  /** API-level "code" / "status" field from Surepass. */
  status_code?: number;
  message?: string;
  data?: T;
  /** True when SUREPASS_TOKEN is not set — caller should fail closed. */
  not_configured?: boolean;
  /** Round-trip time in ms. Useful for the verification log. */
  duration_ms?: number;
}

async function call<T = unknown>(
  path: string,
  body: Record<string, unknown>,
): Promise<SurepassResult<T>> {
  const token = getToken();
  if (!token) {
    return {
      ok: false,
      not_configured: true,
      message:
        "SUREPASS_TOKEN is not set on the server. Configure it from /admin/credentials.",
    };
  }
  const url = `${getBase()}${path}`;
  const started = Date.now();

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      // 20s ceiling — Surepass calls usually return within 5s.
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Network error",
      duration_ms: Date.now() - started,
    };
  }

  const duration_ms = Date.now() - started;

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return {
      ok: false,
      http_status: res.status,
      message: `Non-JSON response (HTTP ${res.status})`,
      duration_ms,
    };
  }

  const obj = (json ?? {}) as {
    success?: boolean;
    status_code?: number;
    message?: string;
    message_code?: string;
    data?: T;
  };
  return {
    ok: res.ok && (obj.success ?? true) && (obj.status_code ?? 200) < 400,
    http_status: res.status,
    status_code: obj.status_code,
    message: obj.message ?? obj.message_code,
    data: obj.data,
    duration_ms,
  };
}

// ---------------------------------------------------------------------------
// PAN
// ---------------------------------------------------------------------------

export interface PanData {
  pan_number: string;
  full_name?: string;
  category?: string;
  /** Y / N from Surepass. */
  aadhaar_seeding_status?: string;
}

export async function verifyPan(
  pan_number: string,
): Promise<SurepassResult<PanData>> {
  return call<PanData>("/api/v1/pan/pan-comprehensive", {
    id_number: pan_number.toUpperCase(),
  });
}

// ---------------------------------------------------------------------------
// Bank — Penny Drop
// ---------------------------------------------------------------------------

export interface BankData {
  account_exists?: boolean;
  full_name?: string;
  /** Surepass returns various extra fields — keep them as unknown. */
  ifsc_details?: Record<string, unknown>;
}

export async function bankPennyDrop(
  account_number: string,
  ifsc: string,
): Promise<SurepassResult<BankData>> {
  return call<BankData>("/api/v1/bank-verification/", {
    id_number: account_number,
    ifsc: ifsc.toUpperCase(),
    ifsc_details: true,
  });
}

// ---------------------------------------------------------------------------
// Aadhaar (OTP)
// ---------------------------------------------------------------------------

export interface AadhaarOtpStartData {
  client_id: string;
  otp_sent?: boolean;
  if_number?: boolean;
  valid_aadhaar?: boolean;
}

export async function aadhaarOtpStart(
  aadhaar_number: string,
): Promise<SurepassResult<AadhaarOtpStartData>> {
  return call<AadhaarOtpStartData>("/api/v1/aadhaar-v2/generate-otp", {
    id_number: aadhaar_number,
  });
}

export interface AadhaarOtpVerifyData {
  full_name?: string;
  aadhaar_number?: string;
  dob?: string;
  gender?: string;
  address?: Record<string, unknown>;
}

export async function aadhaarOtpVerify(
  client_id: string,
  otp: string,
): Promise<SurepassResult<AadhaarOtpVerifyData>> {
  return call<AadhaarOtpVerifyData>("/api/v1/aadhaar-v2/submit-otp", {
    client_id,
    otp,
  });
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** Last 4 digits of any string of digits, useful for redaction. */
export function last4(s: string | undefined | null): string {
  if (!s) return "";
  const digits = String(s).replace(/\D/g, "");
  return digits.slice(-4);
}

/** Mask a string except the last 4 chars. */
export function maskLast4(s: string | undefined | null): string {
  if (!s) return "";
  if (s.length <= 4) return s;
  return "X".repeat(s.length - 4) + s.slice(-4);
}
