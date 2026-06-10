// GET /api/account/download/<token> — re-download a purchased file from the
// signed-in buyer's account. Unlike /api/download/<token> (the anonymous,
// limit-enforced emailed link), this requires a verified buyer session whose
// email OWNS the grant, so it bypasses the per-link download limit: the limit
// exists to stop anonymous link-sharing, not to stop the verified owner from
// re-downloading what they paid for. Rate-limited to keep that from being
// abused to mass-redistribute.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { signedDownloadUrl } from "@/lib/downloads";
import { BUYER_COOKIE, verifyBuyerSession } from "@/lib/buyer-portal";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Grant {
  file_url: string;
  file_name: string | null;
  buyer_email: string;
}

export async function GET(
  req: Request,
  { params }: { params: { token: string } },
) {
  // Must be a signed-in buyer.
  let email: string | null = null;
  try {
    const raw = cookies().get(BUYER_COOKIE)?.value;
    email = raw ? verifyBuyerSession(raw) : null;
  } catch {
    email = null;
  }
  if (!email) {
    // Bounce to the account portal to sign in, preserving intent loosely.
    const url = new URL("/account", req.url);
    return NextResponse.redirect(url, 302);
  }

  // Generous per-buyer cap so a verified owner can re-grab their files but
  // can't script thousands of pulls for redistribution.
  const rl = await rateLimit(`acct-dl:${email.toLowerCase()}`, 40, 24 * 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const admin = createAdminClient();
  const { data: grant } = await admin
    .from("download_grants")
    .select("file_url, file_name, buyer_email")
    .eq("token", params.token)
    .maybeSingle<Grant>();
  if (!grant) {
    return new NextResponse("This download link is invalid.", { status: 404 });
  }
  // Ownership: the session email must match the grant's buyer.
  if ((grant.buyer_email ?? "").toLowerCase() !== email.toLowerCase()) {
    return new NextResponse("This download isn't on your account.", { status: 403 });
  }

  const url = await signedDownloadUrl(grant.file_url, grant.file_name, admin);
  if (!url) {
    return new NextResponse("This file is currently unavailable.", { status: 500 });
  }

  // Note: intentionally does NOT consume the per-link limit — identity is
  // verified, so this is the owner re-downloading, not link-sharing.
  return NextResponse.redirect(url, 302);
}
