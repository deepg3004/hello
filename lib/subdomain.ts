// =============================================================================
// Auto-assign a personal subdomain to a seller. Mirrors the SQL backfill
// (migration 047) for new users: derive a slug from their name/email, dedupe
// against taken subdomains + the reserved list, and stamp it on the profile.
// Idempotent — returns the existing subdomain if one is already set. Best-effort
// Cloudflare CNAME (no-ops while CF is unconfigured; *.invoxai.io resolves via
// the wildcard nginx vhost). Server-only; never throws into callers.
// =============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import {
  HARD_RESERVED_SUBDOMAINS,
  SUBDOMAIN_REGEX,
  appRootHost,
  platformRootDomain,
} from "@/lib/domains";
import { upsertCname } from "@/lib/cloudflare";

/** Slugify a free-text seed into a valid subdomain base (no uniqueness yet). */
function slugifyBase(seed: string): string {
  let base = (seed || "seller")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Subdomain must start with a letter.
  if (!/^[a-z]/.test(base)) base = `s${base}`;
  // Leave room for a numeric suffix; re-trim trailing hyphens after the clamp.
  base = base.slice(0, 28).replace(/-+$/g, "");
  if (base.length < 3) base = "seller";
  return base;
}

/**
 * Ensure `userId` has a subdomain. Returns the (existing or newly-assigned)
 * subdomain, or null if assignment failed. Safe to call on every login.
 */
export async function ensureSubdomainForUser(
  userId: string,
  seed: string,
): Promise<string | null> {
  try {
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("user_profiles")
      .select("subdomain")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.subdomain) return profile.subdomain;

    const base = slugifyBase(seed);

    // Pull taken + reserved names so we can dedupe in-process.
    const [{ data: taken }, { data: reserved }] = await Promise.all([
      admin.from("user_profiles").select("subdomain").not("subdomain", "is", null),
      admin.from("reserved_subdomains").select("name"),
    ]);
    const used = new Set<string>([
      ...HARD_RESERVED_SUBDOMAINS,
      ...((taken ?? []).map((r) => r.subdomain).filter(Boolean) as string[]),
      ...((reserved ?? []).map((r) => r.name).filter(Boolean) as string[]),
    ]);

    let candidate = base;
    let n = 1;
    while (used.has(candidate) || !SUBDOMAIN_REGEX.test(candidate)) {
      n += 1;
      candidate = `${base.slice(0, 26).replace(/-+$/g, "")}${n}`;
      if (n > 9999) return null; // pathological guard
    }

    // Stamp it. The DB unique index is the real race guard; on conflict we bail
    // (the safety-net caller will retry on the next request).
    const { error } = await admin
      .from("user_profiles")
      .update({
        subdomain: candidate,
        subdomain_claimed_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) return null;

    // Best-effort DNS (skips silently when Cloudflare isn't configured).
    try {
      await upsertCname({
        name: `${candidate}.${platformRootDomain()}`,
        target: appRootHost(),
        proxied: true,
        comment: `invoxai seller ${userId}`,
      });
    } catch {
      /* non-fatal — wildcard nginx vhost serves the subdomain regardless */
    }

    return candidate;
  } catch {
    return null;
  }
}
