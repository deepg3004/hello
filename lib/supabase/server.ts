import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import { requireEnv } from "@/lib/env";
import { authCookieDomain } from "@/lib/domains";

export function createClient() {
  const cookieStore = cookies();
  // Cross-subdomain session: scope auth cookies to .invoxai.io so the apex,
  // app.* and admin.* share one login. Host-only on localhost / custom domains.
  let cookieDomain: string | undefined;
  try {
    cookieDomain = authCookieDomain(headers().get("host"));
  } catch {
    cookieDomain = undefined;
  }

  // Use requireEnv instead of `process.env.X!` so a missing key throws a
  // clear, debuggable EnvMissingError naming the file and the .env path
  // instead of a cryptic "Your project's URL and Key are required to create
  // a Supabase client!" deep inside @supabase/ssr. See lib/env.ts header for
  // the outage that motivated this.
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL", "lib/supabase/server.ts");
  const anon = requireEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "lib/supabase/server.ts",
  );

  // @supabase/ssr v0.5 getAll/setAll API. setAll writes EVERY cookie the auth
  // library wants to update in one shot — critical because the session is split
  // into chunked cookies (sb-…-auth-token.0/.1); the old per-cookie set() lost
  // chunks and corrupted the session, which made every later request look
  // expired and triggered a refresh-token storm (refresh_token_already_used).
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set({
              name,
              value,
              ...options,
              ...(cookieDomain ? { domain: cookieDomain } : {}),
            });
          }
        } catch {
          // Called from a Server Component — Next forbids cookie mutation here.
          // Middleware is the designated refresher (it CAN write cookies), so
          // ignoring this is safe. Server actions / route handlers DO persist.
        }
      },
    },
  });
}
