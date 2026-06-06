"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/account-context";
import {
  HARD_RESERVED_SUBDOMAINS,
  appRootHost,
  normaliseDomain,
  normaliseSubdomain,
  platformRootDomain,
  validateDomain,
  validateSubdomain,
} from "@/lib/domains";
import {
  deleteRecord,
  getCustomHostname,
  provisionCustomHostname,
  resolveCnameChain,
  upsertCname,
} from "@/lib/cloudflare";
import type { DcvRecord } from "@/lib/cloudflare";
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

  const expected = appRootHost();
  const { matched, chain, final } = await resolveCnameChain(domain, expected);

  const nowIso = new Date().toISOString();
  if (!matched) {
    await admin
      .from("user_profiles")
      .update({
        custom_domain_verified_at: null,
        custom_domain_cert_status: "pending",
        custom_domain_last_checked_at: nowIso,
        custom_domain_last_error: final
          ? `CNAME points to ${final} (expected ${expected}). Chain: ${chain.join(" → ")}`
          : `No CNAME found for ${domain} pointing to ${expected}.`,
      })
      .eq("id", ctx.ownerId);
    return {
      ok: false,
      message: final
        ? `CNAME currently points to ${final}. Update it to ${expected} and try again.`
        : `No CNAME found for ${domain} pointing to ${expected} yet. DNS can take a few minutes to propagate.`,
    };
  }

  // CNAME verified — register the hostname with Cloudflare for SaaS so it
  // mints a TLS cert. CF returns the cert state + any DCV records the seller
  // still has to add.
  let certStatus: "pending" | "provisioning" | "active" = "active";
  let dcv: DcvRecord[] | null = null;
  const provision = await provisionCustomHostname(domain);
  if (provision.skipped) {
    // Cloudflare for SaaS isn't configured — operator runs cert-manager on the
    // VPS instead, so leave the row marked active and let that take over.
    certStatus = "active";
  } else if (provision.ok && provision.data) {
    certStatus = provision.data.certStatus === "failed"
      ? "provisioning"
      : provision.data.certStatus;
    dcv = provision.data.dcv.length ? provision.data.dcv : null;
  } else {
    // CF rejected the POST (commonly: hostname already onboarded). Read the
    // existing record back so we still capture its real status + DCV.
    const existing = await getCustomHostname(domain);
    if (existing.ok && existing.data) {
      certStatus = existing.data.certStatus === "failed"
        ? "provisioning"
        : existing.data.certStatus;
      dcv = existing.data.dcv.length ? existing.data.dcv : null;
    } else {
      certStatus = "provisioning";
    }
  }

  await admin
    .from("user_profiles")
    .update({
      custom_domain_verified_at: nowIso,
      custom_domain_cert_status: certStatus,
      custom_domain_last_checked_at: nowIso,
      custom_domain_last_error: null,
      custom_domain_dcv: dcv,
    })
    .eq("id", ctx.ownerId);

  await bustHostCache(domain);
  revalidatePath("/dashboard/settings/domains");
  return {
    ok: true,
    message:
      certStatus === "active"
        ? "Verified and live."
        : dcv
          ? "Verified! Add the extra SSL record shown below, then click Refresh status."
          : "Verified! Certificate is being issued — usually live in a few minutes.",
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

  const current = await getCustomHostname(domain);
  if (current.skipped) {
    return { ok: true, message: "Certificate is managed on the server." };
  }
  if (!current.ok) {
    return {
      ok: false,
      message: current.message ?? "Couldn't reach Cloudflare.",
    };
  }
  if (!current.data) {
    return {
      ok: false,
      message: "Cloudflare has no record for this domain yet — try Verify DNS.",
    };
  }

  const { certStatus, dcv, error } = current.data;
  const dbStatus = certStatus === "failed" ? "failed" : certStatus;
  await admin
    .from("user_profiles")
    .update({
      custom_domain_cert_status: dbStatus,
      custom_domain_last_checked_at: new Date().toISOString(),
      custom_domain_last_error: error,
      custom_domain_dcv: dcv.length ? dcv : null,
    })
    .eq("id", ctx.ownerId);

  revalidatePath("/dashboard/settings/domains");
  return {
    ok: true,
    message:
      certStatus === "active"
        ? "Certificate is live 🎉"
        : certStatus === "failed"
          ? "Validation failed — check the record values and try again."
          : "Still issuing — add the SSL record below if shown, then check again.",
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
    })
    .eq("id", ctx.ownerId);
  await bustHostCache(previous);
  revalidatePath("/dashboard/settings/domains");
  return { ok: true };
}
