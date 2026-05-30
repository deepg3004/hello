// POST /api/affiliate/portal/bank
//
// Body: { account_number, ifsc, holder_name }
//
// Saves bank details on every affiliate_link row that belongs to this
// email. Validated client-side and re-checked server-side.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { PORTAL_COOKIE, verifyPortalSession } from "@/lib/affiliate";

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export async function POST(request: Request) {
  const token = cookies().get(PORTAL_COOKIE)?.value;
  const email = token ? verifyPortalSession(token) : null;
  if (!email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: {
    account_number?: string;
    ifsc?: string;
    holder_name?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const accountNumber = body.account_number?.replace(/\s/g, "");
  const ifsc = body.ifsc?.trim().toUpperCase();
  const holderName = body.holder_name?.trim();

  if (!accountNumber || !/^[0-9]{6,18}$/.test(accountNumber)) {
    return NextResponse.json(
      { error: "Account number should be 6-18 digits." },
      { status: 400 },
    );
  }
  if (!ifsc || !IFSC_RE.test(ifsc)) {
    return NextResponse.json(
      { error: "IFSC format looks wrong (4 letters + 0 + 6 alphanumerics)." },
      { status: 400 },
    );
  }
  if (!holderName || holderName.length < 2) {
    return NextResponse.json(
      { error: "Account holder name is required." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("affiliate_links")
    .update({
      bank_account_number: accountNumber,
      bank_ifsc: ifsc,
      bank_holder_name: holderName,
      bank_verified_at: new Date().toISOString(),
    })
    .eq("referrer_email", email);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
