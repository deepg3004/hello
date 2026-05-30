// Cashfree Payouts v1 client — token cache, beneficiary upsert, transfer.
// Server-only. Falls back gracefully when credentials are missing.

let cachedToken: { value: string; expires: number } | null = null;

function envBase(): string {
  return process.env.CASHFREE_BASE_URL ?? "https://payout-api.cashfree.com";
}

export function isCashfreeConfigured(): boolean {
  return !!(process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET);
}

interface AuthorizeResponse {
  status: string;
  message: string;
  data?: { token: string; expiry?: number };
}

async function getToken(): Promise<string> {
  if (!isCashfreeConfigured()) {
    throw new Error(
      "Cashfree credentials missing (CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET).",
    );
  }
  if (cachedToken && cachedToken.expires - 60_000 > Date.now()) {
    return cachedToken.value;
  }
  const res = await fetch(`${envBase()}/payout/v1/authorize`, {
    method: "POST",
    headers: {
      "X-Client-Id": process.env.CASHFREE_CLIENT_ID!,
      "X-Client-Secret": process.env.CASHFREE_CLIENT_SECRET!,
    },
  });
  const body = (await res.json()) as AuthorizeResponse;
  if (!body.data?.token) {
    throw new Error(`Cashfree auth failed: ${body.message}`);
  }
  cachedToken = {
    value: body.data.token,
    // Cashfree tokens last 15 minutes by default.
    expires: Date.now() + 14 * 60_000,
  };
  return cachedToken.value;
}

async function call<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: string; message?: string; data?: T }> {
  const token = await getToken();
  const res = await fetch(`${envBase()}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    status: string;
    subCode?: string;
    message?: string;
    data?: T;
  };
  return {
    ok: res.ok && json.status === "SUCCESS",
    status: json.status,
    message: json.message,
    data: json.data,
  };
}

// ---- Beneficiary -----------------------------------------------------------

export interface CashfreeBeneficiary {
  beneId: string;
  name: string;
  email: string;
  phone: string;
  bankAccount: string;
  ifsc: string;
  address1?: string;
}

export async function upsertBeneficiary(b: CashfreeBeneficiary) {
  // Cashfree's addBeneficiary is idempotent on beneId.
  return call("/payout/v1/addBeneficiary", b as unknown as Record<string, unknown>);
}

// ---- Transfer --------------------------------------------------------------

export interface CashfreeTransferArgs {
  /** Idempotency key — usually our internal payouts.id. */
  transferId: string;
  beneId: string;
  amount: number; // INR (rupees)
  remarks?: string;
  /** IMPS | NEFT | RTGS | UPI */
  transferMode?: "IMPS" | "NEFT" | "RTGS" | "UPI";
}

export interface CashfreeTransferData {
  referenceId: string;
  utr?: string;
  acknowledged?: number;
}

export async function requestTransfer(args: CashfreeTransferArgs) {
  return call<CashfreeTransferData>("/payout/v1/requestTransfer", {
    beneId: args.beneId,
    amount: args.amount,
    transferId: args.transferId,
    remarks: args.remarks ?? "InvoxAI Earnings Payout",
    transferMode: args.transferMode ?? "IMPS",
  });
}
