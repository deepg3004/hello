// GET /api/buyer/google/callback
//
// The single registered Google redirect URI (runs on BUYER_OAUTH_BASE_URL).
// Verifies the signed state, exchanges the code for a verified Google profile,
// records the buyer account + login event, then hands the result back to the
// originating seller host via a short-lived signed token (the buyer's session
// cookie can only be set on that host, not here).

import { NextResponse, type NextRequest } from "next/server";

import {
  verifyBuyerOAuthState,
  signBuyerHandoff,
} from "@/lib/buyer-portal";
import { recordBuyerLogin } from "@/lib/buyers";
import { exchangeCodeForProfile, getGoogleBuyerConfig } from "@/lib/buyer-google";

function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");

  // Verify the state first — it tells us which host to return the buyer to.
  const state = stateRaw ? verifyBuyerOAuthState(stateRaw) : null;
  if (!state || !code) {
    // No trustworthy origin host — fail on the central host's own /account.
    const fail = new URL("/account", request.url);
    fail.searchParams.set("login", "google_failed");
    return NextResponse.redirect(fail);
  }

  const origin = `https://${state.host}`;
  const cfg = await getGoogleBuyerConfig();
  const profile = await exchangeCodeForProfile(code, cfg);
  if (!profile) {
    return NextResponse.redirect(`${origin}/account?login=google_failed`);
  }

  await recordBuyerLogin({
    email: profile.email,
    provider: "google",
    name: profile.name,
    avatarUrl: profile.picture,
    googleId: profile.sub,
    emailVerified: true,
    host: state.host,
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  const handoff = signBuyerHandoff(profile.email);
  return NextResponse.redirect(
    `${origin}/api/buyer/google/finish?token=${encodeURIComponent(handoff)}`,
  );
}
