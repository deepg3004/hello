import { createBrowserClient } from "@supabase/ssr";

import { authCookieDomain } from "@/lib/domains";

export function createClient() {
  // IMPORTANT: read these as STATIC `process.env.NEXT_PUBLIC_*` member
  // accesses. Next.js only inlines NEXT_PUBLIC_* values into the browser
  // bundle when they are referenced as a static literal at build time. A
  // dynamic lookup (e.g. requireEnv -> process.env[name]) is NOT replaced and
  // resolves to `undefined` in the browser, which made createClient() throw
  // and silently broke client-side login / OAuth / signup. So we deliberately
  // do NOT use requireEnv() here — that helper is server-only.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase browser client misconfigured: NEXT_PUBLIC_SUPABASE_URL / " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY were not inlined into the client bundle. " +
        "They must be present at BUILD time (next build reads .env.production) " +
        "and read as static process.env.NEXT_PUBLIC_* literals.",
    );
  }
  // Scope the auth cookie to .invoxai.io so a login carries across the apex,
  // app.* and admin.* (host-only on localhost / custom domains).
  const domain =
    typeof window !== "undefined"
      ? authCookieDomain(window.location.hostname)
      : undefined;

  // Disable the browser's background token-refresh timer. The SERVER
  // (middleware) is the single source of truth for refreshing + rotating the
  // session cookie. When the browser ALSO auto-refreshed, the two raced to
  // rotate the same refresh token -> `refresh_token_already_used` storms that
  // exhausted the GoTrue rate limit and 429'd login. Login itself
  // (signInWithPassword) and the stored session are unaffected; middleware
  // keeps the cookie fresh on every navigation.
  return createBrowserClient(url, anon, {
    auth: { autoRefreshToken: false },
    ...(domain ? { cookieOptions: { domain } } : {}),
  });
}
