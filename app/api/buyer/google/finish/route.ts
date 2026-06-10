// GET /api/buyer/google/finish
//
// Runs on the originating seller host. Verifies the short-lived handoff token
// from the central callback and sets the buyer session cookie HERE (same cookie
// /account + the email-OTP flow use), then sends the buyer to their purchases.

import { NextResponse, type NextRequest } from "next/server";

import {
  BUYER_COOKIE,
  BUYER_COOKIE_TTL_DAYS,
  verifyBuyerHandoff,
  signBuyerSession,
} from "@/lib/buyer-portal";

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token");
  const email = token ? verifyBuyerHandoff(token) : null;

  const account = new URL("/account", request.url);
  if (!email) {
    account.searchParams.set("login", "expired");
    return NextResponse.redirect(account);
  }

  const response = NextResponse.redirect(account);
  response.cookies.set({
    name: BUYER_COOKIE,
    value: signBuyerSession(email),
    maxAge: BUYER_COOKIE_TTL_DAYS * 86_400,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
  return response;
}
