// Handles three callback flows:
//   1. OAuth providers (Google) — ?code=...
//   2. Email confirmation       — ?token_hash=...&type=signup
//   3. Password reset           — ?token_hash=...&type=recovery
//
// Always lands on `next` (defaults to /dashboard) on success.

import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/dashboard";

  const redirect = new URL(next, url.origin);

  const supabase = createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
    return NextResponse.redirect(redirect);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
    return NextResponse.redirect(redirect);
  }

  return NextResponse.redirect(new URL("/login?error=invalid_callback", url.origin));
}
