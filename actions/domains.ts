"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
import { requireAdmin, writeAuditLog } from "@/lib/admin/audit";
import {
  HARD_RESERVED_SUBDOMAINS,
  appRootHost,
  customDomainTargetIps,
  normaliseDomain,
  normaliseSubdomain,
  platformRootDomain,
  validateDomain,
  validateSubdomain,
} from "@/lib/domains";
import {
  deleteRecord,
  resolveARecords,
  upsertCname,
} from "@/lib/cloudflare";
import { getRedis } from "@/lib/redis";

interface Ok {
  ok: true;
  message?: string;
}
interface Err {
  ok: false;
  message: string;
}
type Result = Ok | Err;

async function bustHostCache(host?: string | null): Promise<void> {
  if (!host) return;
  const redis = getRedis();
  if (!redis) return;
  try {
    const { hostLookupCacheKey } = await import("@/lib/domains");
    await redis.del(hostLookupCacheKey(host));
  } catch {
    /* not fatal */
  }
}

// ---------------------------------------------------------------------------
// Subdomain
// ---------------------------------------------------------------------------

export async function claimSubdomainAction(input: {
  subdomain: string;
}): Promise<Result> {
  const actor = await requireActor("domains.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const sd = normaliseSubdomain(input.subdomain);
  const validation = validateSubdomain(sd);
  if (!validation.ok) {
    return { ok: false, message: validation.message ?? "Invalid subdomain" };
  }

  const admin = createAdminClient();

  // DB-side reserved list — admins can add more without code changes.
  if (HARD_RESERVED_SUBDOMAINS.has(sd)) {
    return { ok: false, message: "That subdomain is reserved." };
  }
  const { data: reserved } = await admin
    .from("reserved_subdomains")
    .select("name")
    .eq("name", sd)
    .maybeSingle();
  if (reserved) {
    return { ok: false, message: "That subdomain is reserved." };
  }

  // Uniqueness check (separate from DB unique index so we surface a friendly
  // error before the API call).
  const { data: clash } = await admin
    .from("user_profiles")
    .select("id")
    .eq("subdomain", sd)
    .neq("id", ctx.ownerId)
    .maybeSingle();
  if (clash) {
    return { ok: false, message: "That subdomain is already taken." };
  }

  // Read the seller's current subdomain so we can bust the old CF record
  // when they change handles.
  const { data: profile } = await admin
    .from("user_profiles")
    .select("subdomain, subdomain_cf_record_id")
    .eq("id", ctx.ownerId)
    .single();
  const previous = profile?.subdomain ?? null;
  const previousCfId = profile?.subdomain_cf_record_id ?? null;

  // 1. Stamp the new subdomain in our DB first (race-safe — DB unique index
  //    catches simultaneous claims).
  const { error: updateErr } = await admin
    .from("user_profiles")
    .update({
      subdomain: sd,
      subdomain_claimed_at: new Date().toISOString(),
    })
    .eq("id", ctx.ownerId);
  if (updateErr) {
    if (updateErr.code === "23505") {
      return { ok: false, message: "That subdomain is already taken." };
    }
    return { ok: false, message: updateErr.message };
  }

  // 2. Try to create the Cloudflare CNAME. Failure here doesn't undo the
  //    DB write — instead we surface a warning so the admin can fix it.
  const apex = platformRootDomain();
  const cf = await upsertCname({
    name: `${sd}.${apex}`,
    target: appRootHost(),
    proxied: true,
    comment: `invoxai seller ${ctx.ownerId}`,
  });

  if (cf.ok && cf.data?.id) {
    await admin
      .from("user_profiles")
      .update({ subdomain_cf_record_id: cf.data.id })
      .eq("id", ctx.ownerId);
  }

  // 3. If the seller changed subdomains, delete the old CF record.
  if (previous && previous !== sd && previousCfId) {
    await deleteRecord(previousCfId).catch(() => undefined);
  }

  // 4. Bust caches for the old + new hostnames.
  await Promise.all([
    bustHostCache(previous ? `${previous}.${apex}` : null),
    bustHostCache(`${sd}.${apex}`),
  ]);

  revalidatePath("/dashboard/settings/domains");
  return {
    ok: true,
    message: cf.skipped
      ? "Subdomain saved. DNS CNAME wasn't created — Cloudflare credentials aren't configured."
      : cf.ok
        ? undefined
        : `Subdomain saved but Cloudflare returned: ${cf.message ?? "unknown error"}`,
  };
}

// ---------------------------------------------------------------------------
// Custom domain — claim + verify
// ---------------------------------------------------------------------------

export async function claimCustomDomainAction(input: {
  domain: string;
}): Promise<Result> {
  const actor = await requireActor("domains.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const d = normaliseDomain(input.domain);
  const validation = validateDomain(d);
  if (!validation.ok) {
    return { ok: false, message: validation.message ?? "Invalid domain" };
  }

  const admin = createAdminClient();

  // Feature-flag gate only — custom domains are available on every plan.
  const [{ data: profile }, { data: flag }] = await Promise.all([
    admin
      .from("user_profiles")
      .select("custom_domain")
      .eq("id", ctx.ownerId)
      .single(),
    admin
      .from("platform_settings")
      .select("value")
      .eq("key", "feature_custom_domains")
      .maybeSingle(),
  ]);
  if (flag?.value === "false") {
    return {
      ok: false,
      message: "Custom domains are disabled platform-wide right now.",
    };
  }

  // Uniqueness — another seller can't already own this hostname.
  const { data: clash } = await admin
    .from("user_profiles")
    .select("id")
    .eq("custom_domain", d)
    .neq("id", ctx.ownerId)
    .maybeSingle();
  if (clash) {
    return {
      ok: false,
      message: "Another InvoxAI seller has already claimed this domain.",
    };
  }

  const previous = profile?.custom_domain ?? null;
  const { error } = await admin
    .from("user_profiles")
    .update({
      custom_domain: d,
      custom_domain_verified_at: null,
      custom_domain_cert_status: "pending",
      custom_domain_last_checked_at: null,
      custom_domain_last_error: null,
    })
    .eq("id", ctx.ownerId);
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: "Another InvoxAI seller has already claimed this domain.",
      };
    }
    return { ok: false, message: error.message };
  }

  await Promise.all([bustHostCache(previous), bustHostCache(d)]);
  revalidatePath("/dashboard/settings/domains");
  return { ok: true };
}

/**
 * Best-effort liveness probe: does the domain already serve HTTPS with a cert
 * our runtime trusts? A successful fetch means the TLS handshake completed
 * (valid cert); any cert/connection error throws and we treat it as not-live.
 */
async function isServingHttps(domain: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`https://${domain}/`, {
      method: "HEAD",
      redirect: "manual",
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    return res.status > 0;
  } catch {
    return false;
  }
}

export async function verifyCustomDomainAction(): Promise<Result> {
  const actor = await requireActor("domains.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("custom_domain")
    .eq("id", ctx.ownerId)
    .single();
  const domain = profile?.custom_domain;
  if (!domain) {
    return { ok: false, message: "No custom domain to verify." };
  }

  // We terminate TLS for custom domains on our ingress box (certbot + nginx),
  // so the seller points an A record at it. Verify that A record resolves to us
  // (apex domains can't CNAME, so this is the only portable check).
  const targetIps = customDomainTargetIps();
  const domainIps = await resolveARecords(domain);
  const matched = domainIps.some((ip) => targetIps.includes(ip));
  const nowIso = new Date().toISOString();

  if (!matched) {
    const seen = domainIps.length ? domainIps.join(", ") : "no A record";
    await admin
      .from("user_profiles")
      .update({
        custom_domain_verified_at: null,
        custom_domain_cert_status: "pending",
        custom_domain_last_checked_at: nowIso,
        custom_domain_last_error: `${domain} resolves to ${seen}; expected an A record pointing to ${targetIps[0]}.`,
      })
      .eq("id", ctx.ownerId);
    return {
      ok: false,
      message: `Point an A record for ${domain} to ${targetIps[0]} and try again. It currently resolves to ${seen}. DNS can take a few minutes to propagate.`,
    };
  }

  // DNS is correct. The TLS cert is issued out-of-band on the ingress box.
  // Probe HTTPS so we can show "live" immediately if the cert is already in
  // place; otherwise mark provisioning until it's installed.
  const live = await isServingHttps(domain);
  await admin
    .from("user_profiles")
    .update({
      custom_domain_verified_at: nowIso,
      custom_domain_cert_status: live ? "active" : "provisioning",
      custom_domain_last_checked_at: nowIso,
      custom_domain_last_error: null,
      custom_domain_dcv: null,
    })
    .eq("id", ctx.ownerId);

  await bustHostCache(domain);
  revalidatePath("/dashboard/settings/domains");
  return {
    ok: true,
    message: live
      ? "Verified and live."
      : "DNS verified! The SSL certificate is being issued — usually live within a few minutes. Click Refresh status to check.",
  };
}

// ---------------------------------------------------------------------------
// Custom domain — poll cert status (provisioning → active)
// ---------------------------------------------------------------------------

export async function refreshCustomDomainStatusAction(): Promise<Result> {
  const actor = await requireActor("domains.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("custom_domain")
    .eq("id", ctx.ownerId)
    .single();
  const domain = profile?.custom_domain;
  if (!domain) {
    return { ok: false, message: "No custom domain to check." };
  }

  // TLS is terminated on our ingress box; poll the live HTTPS endpoint to see
  // whether the certificate has been installed yet.
  const live = await isServingHttps(domain);
  await admin
    .from("user_profiles")
    .update({
      custom_domain_cert_status: live ? "active" : "provisioning",
      custom_domain_last_checked_at: new Date().toISOString(),
      custom_domain_last_error: live
        ? null
        : "Certificate not active yet — still being issued.",
    })
    .eq("id", ctx.ownerId);

  revalidatePath("/dashboard/settings/domains");
  return {
    ok: true,
    message: live
      ? "Certificate is live 🎉"
      : "Still issuing — the SSL certificate isn't active yet. Check again in a few minutes.",
  };
}

export async function removeCustomDomainAction(): Promise<Result> {
  const actor = await requireActor("domains.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("custom_domain")
    .eq("id", ctx.ownerId)
    .single();
  const previous = profile?.custom_domain ?? null;
  await admin
    .from("user_profiles")
    .update({
      custom_domain: null,
      custom_domain_verified_at: null,
      custom_domain_cert_status: null,
      custom_domain_last_checked_at: null,
      custom_domain_last_error: null,
      // No custom domain left to redirect to — disable the toggle.
      subdomain_redirect_to_custom: false,
    })
    .eq("id", ctx.ownerId);
  await bustHostCache(previous);
  revalidatePath("/dashboard/settings/domains");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin overrides — re-verify / release a seller's custom domain on their
// behalf (support ops). Reuse the exact DNS + TLS checks above; gate on
// requireAdmin and audit-log each action.
// ---------------------------------------------------------------------------

export async function adminReVerifyCustomDomainAction(
  userId: string,
): Promise<Result> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (!userId) return { ok: false, message: "Missing user." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("custom_domain")
    .eq("id", userId)
    .single();
  const domain = profile?.custom_domain;
  if (!domain) return { ok: false, message: "This seller has no custom domain." };

  const targetIps = customDomainTargetIps();
  const domainIps = await resolveARecords(domain);
  const matched = domainIps.some((ip) => targetIps.includes(ip));
  const nowIso = new Date().toISOString();

  if (!matched) {
    const seen = domainIps.length ? domainIps.join(", ") : "no A record";
    await admin
      .from("user_profiles")
      .update({
        custom_domain_verified_at: null,
        custom_domain_cert_status: "pending",
        custom_domain_last_checked_at: nowIso,
        custom_domain_last_error: `${domain} resolves to ${seen}; expected an A record pointing to ${targetIps[0]}.`,
      })
      .eq("id", userId);
    await writeAuditLog({
      admin_id: adminId,
      action: "custom_domain.admin_reverify_failed",
      target_type: "user_profile",
      target_id: userId,
      details: { domain, resolved: seen },
    });
    await bustHostCache(domain);
    revalidatePath("/admin/domains");
    return { ok: false, message: `${domain} resolves to ${seen} — not pointing at us yet.` };
  }

  const live = await isServingHttps(domain);
  await admin
    .from("user_profiles")
    .update({
      custom_domain_verified_at: nowIso,
      custom_domain_cert_status: live ? "active" : "provisioning",
      custom_domain_last_checked_at: nowIso,
      custom_domain_last_error: null,
      custom_domain_dcv: null,
    })
    .eq("id", userId);

  await writeAuditLog({
    admin_id: adminId,
    action: "custom_domain.admin_reverified",
    target_type: "user_profile",
    target_id: userId,
    details: { domain, cert_status: live ? "active" : "provisioning" },
  });
  await bustHostCache(domain);
  revalidatePath("/admin/domains");
  return {
    ok: true,
    message: live ? `${domain} verified and live.` : `${domain} DNS verified; cert still provisioning.`,
  };
}

export async function adminReleaseCustomDomainAction(
  userId: string,
): Promise<Result> {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (!userId) return { ok: false, message: "Missing user." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("custom_domain")
    .eq("id", userId)
    .single();
  const previous = profile?.custom_domain ?? null;
  if (!previous) return { ok: false, message: "This seller has no custom domain." };

  await admin
    .from("user_profiles")
    .update({
      custom_domain: null,
      custom_domain_verified_at: null,
      custom_domain_cert_status: null,
      custom_domain_last_checked_at: null,
      custom_domain_last_error: null,
      custom_domain_dcv: null,
      subdomain_redirect_to_custom: false,
    })
    .eq("id", userId);

  await writeAuditLog({
    admin_id: adminId,
    action: "custom_domain.admin_released",
    target_type: "user_profile",
    target_id: userId,
    details: { domain: previous },
  });
  await bustHostCache(previous);
  revalidatePath("/admin/domains");
  return { ok: true, message: `Released ${previous}.` };
}

// ---------------------------------------------------------------------------
// Subdomain → custom-domain redirect toggle
// ---------------------------------------------------------------------------

export async function setSubdomainRedirectAction(input: {
  enabled: boolean;
}): Promise<Result> {
  const actor = await requireActor("domains.manage");
  if (!actor.ok) return { ok: false, message: actor.error };
  const { ctx } = actor;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("subdomain, custom_domain, custom_domain_verified_at")
    .eq("id", ctx.ownerId)
    .single();

  // Can't redirect to a custom domain that isn't set up + verified yet.
  if (
    input.enabled &&
    !(profile?.custom_domain && profile.custom_domain_verified_at)
  ) {
    return {
      ok: false,
      message: "Verify your custom domain first, then turn this on.",
    };
  }

  const { error } = await admin
    .from("user_profiles")
    .update({ subdomain_redirect_to_custom: input.enabled })
    .eq("id", ctx.ownerId);
  if (error) return { ok: false, message: error.message };

  // Bust the subdomain's host-lookup cache so middleware picks up the change.
  if (profile?.subdomain) {
    await bustHostCache(`${profile.subdomain}.${platformRootDomain()}`);
  }
  revalidatePath("/dashboard/settings/domains");
  return {
    ok: true,
    message: input.enabled
      ? "Your subdomain now redirects to your custom domain. It may take a few minutes to take effect."
      : "Redirect turned off — your subdomain serves your store directly again.",
  };
}
