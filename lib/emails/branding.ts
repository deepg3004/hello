// Primes the email shell's branding (platform name + logo + support email)
// from the admin-editable platform_settings, so every transactional email
// uses the live brand instead of the hard-coded "InvoxAI" wordmark.
//
// Called once at process boot (app instrumentation + worker entry) and
// opportunistically (TTL-guarded) before each send, so admin logo/name changes
// propagate within ~5 minutes without a restart.

import { createAdminClient } from "@/lib/supabase/admin";

import { setEmailBranding } from "./layout";

const TTL_MS = 5 * 60_000;
let primedAt = 0;

export async function primeEmailBranding(force = false): Promise<void> {
  if (!force && primedAt && Date.now() - primedAt < TTL_MS) return;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("key, value")
      .in("key", ["platform_name", "platform_logo_url", "support_email"]);
    const m = new Map(
      ((data ?? []) as Array<{ key: string; value: string }>).map((r) => [
        r.key,
        r.value,
      ]),
    );
    setEmailBranding({
      name: m.get("platform_name"),
      logoUrl: m.get("platform_logo_url"),
      supportEmail: m.get("support_email"),
    });
    primedAt = Date.now();
  } catch {
    // Keep whatever branding we already have (defaults on first failure).
  }
}
