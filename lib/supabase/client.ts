import { createBrowserClient } from "@supabase/ssr";

import { requireEnv } from "@/lib/env";

export function createClient() {
  // See lib/env.ts header for why we don't use `process.env.X!` here.
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL", "lib/supabase/client.ts");
  const anon = requireEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "lib/supabase/client.ts",
  );
  return createBrowserClient(url, anon);
}
