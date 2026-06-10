// GET /api/buyer/google/start
//
// Kicks off buyer Google login from whatever seller host the buyer is on. Signs
// the originating host into the OAuth `state` and redirects to Google's consent
// screen (which always returns to the single registered callback host).

import { NextResponse, type NextRequest } from "next/server";

import { signBuyerOAuthState } from "@/lib/buyer-portal";
import { isKnownSellerHost } from "@/lib/buyers";
import { getGoogleBuyerConfig, buildGoogleAuthUrl } from "@/lib/buyer-google";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const accountUrl = new URL("/account", request.url);

  const cfg = await getGoogleBuyerConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    accountUrl.searchParams.set("login", "google_unavailable");
    return NextResponse.redirect(accountUrl);
  }
  if (!(await isKnownSellerHost(host))) {
    return NextResponse.json({ error: "Unknown host" }, { status: 400 });
  }

  const state = signBuyerOAuthState(host);
  return NextResponse.redirect(buildGoogleAuthUrl(state, cfg));
}
