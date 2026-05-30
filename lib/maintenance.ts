// Maintenance-mode gate.
//
// Server-only. Each call hits Postgres (one indexed lookup on a 1-row
// table) — we don't cache across requests because Next.js's static page
// cache already de-dupes within a single render pass, and stale values
// keep buyers locked out longer than expected.

import { createAdminClient } from "@/lib/supabase/admin";

export async function isMaintenanceOn(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle();
    return data?.value === "true";
  } catch {
    // Fail open — never lock buyers out because a DB blip prevented us
    // from reading the flag.
    return false;
  }
}
