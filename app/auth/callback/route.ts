// Handles three callback flows:
//   1. OAuth providers (Google) — ?code=...
//   2. Email confirmation       — ?token_hash=...&type=signup
//   3. Password reset           — ?token_hash=...&type=recovery
//
// Always lands on `next` (defaults to /dashboard) on success.

import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";
import type { SupabaseClient } from "@supabase/supabase-js";

// Ensure the just-authenticated user has a personal subdomain. Best-effort and
// non-blocking — covers OAuth / email-confirm / magic-link signups.
async function ensureSubdomain(supabase: SupabaseClient): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { ensureSubdomainForUser } = await import("@/lib/subdomain");
    const seed =
      (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "seller";
    await ensureSubdomainForUser(user.id, seed);
  } catch {
    /* best-effort */
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  // Sanitise next= — block absolute URLs, protocol-relative URLs, etc.
  // Without this an attacker can craft /login?next=https://evil/ and turn
  // a successful login into an off-platform redirect.
  const next = safeNext(url.searchParams.get("next"));

  const redirect = new URL(next, url.origin);

  const supabase = createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
    await ensureSubdomain(supabase);
    return NextResponse.redirect(redirect);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
    // Only signup/confirm flows should mint a subdomain; recovery just resets a
    // password. ensureSubdomainForUser is idempotent so this is harmless either way.
    if (type !== "recovery") await ensureSubdomain(supabase);
    return NextResponse.redirect(redirect);
  }

  return NextResponse.redirect(new URL("/login?error=invalid_callback", url.origin));
}
