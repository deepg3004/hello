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

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options, ...(cookieDomain ? { domain: cookieDomain } : {}) });
        } catch {
          // Called from a Server Component — Next forbids cookie mutation
          // here. Middleware is responsible for refreshing the session, so
          // ignoring this is safe.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options, ...(cookieDomain ? { domain: cookieDomain } : {}) });
        } catch {
          // See note above.
        }
      },
    },
  });
}
