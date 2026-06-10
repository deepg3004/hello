// =============================================================================
// Domain helpers — pure functions, Edge-safe.
//
// Used by:
//   - middleware.ts        (host → seller lookup)
//   - actions/domains.ts   (claim / verify)
//   - /dashboard/settings  (form validation preview)
// =============================================================================

export const SUBDOMAIN_REGEX = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;
export const SUBDOMAIN_MIN = 3;
export const SUBDOMAIN_MAX = 30;

/**
 * Anything users can't claim because the platform owns it or it would
 * trample our infra routes. The DB also has a reserved_subdomains table —
 * the admin can extend that without a code deploy.
 */
export const HARD_RESERVED_SUBDOMAINS = new Set([
  "www",
  "hello",
  "api",
  "admin",
  "app",
  "mail",
  "static",
  "cdn",
  "blog",
  "docs",
  "status",
  "help",
  "support",
  "pay",
  "checkout",
  "billing",
  "login",
  "signup",
  "auth",
]);

export function normaliseSubdomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(".")[0]!
    .replace(/[^a-z0-9-]/g, "");
}

export function validateSubdomain(input: string): {
  ok: boolean;
  message?: string;
} {
  const sd = input.trim();
  if (sd.length < SUBDOMAIN_MIN) {
    return { ok: false, message: `At least ${SUBDOMAIN_MIN} characters.` };
  }
  if (sd.length > SUBDOMAIN_MAX) {
    return { ok: false, message: `At most ${SUBDOMAIN_MAX} characters.` };
  }
  if (!SUBDOMAIN_REGEX.test(sd)) {
    return {
      ok: false,
      message:
        "Lowercase letters, numbers and single hyphens. Must start with a letter and end with a letter or number.",
    };
  }
  if (HARD_RESERVED_SUBDOMAINS.has(sd)) {
    return { ok: false, message: "That subdomain is reserved." };
  }
  return { ok: true };
}

// ── Apex / root hostname helpers ────────────────────────────────────────

/**
 * The hostname new subdomains CNAME to. Configured via env so we can move
 * the main app without a redeploy of the migration / docs UI.
 */
export function appRootHost(): string {
  return process.env.INVOXAI_APP_ROOT_HOST ?? "hello.invoxai.io";
}

/** "invoxai.io" — the apex we mint subdomains under. */
export function platformRootDomain(): string {
  return process.env.INVOXAI_PLATFORM_ROOT ?? "invoxai.io";
}

/**
 * The public IP(s) of our ingress box that seller CUSTOM domains must point an
 * A record at. We terminate TLS for custom domains on the VPS (certbot +
 * nginx, provisioned by /usr/local/bin/invoxai-provision-domain.sh) rather than
 * via Cloudflare for SaaS, so verification checks the domain's A record matches
 * one of these instead of a CNAME target. Comma-separated env override.
 */
export function customDomainTargetIps(): string[] {
  return (process.env.INVOXAI_CUSTOM_DOMAIN_IPS ?? "187.127.172.108")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Cookie `domain` for the seller/admin auth session so ONE login works across
 * the apex + app.* + admin.* (and any *.invoxai.io). Returns `.invoxai.io` when
 * the request host is under the platform root; `undefined` for localhost or a
 * seller's custom domain (host-only, the correct default there). Without this,
 * a login on one host doesn't carry to the others — they bounce back to /login.
 */
export function authCookieDomain(host: string | null | undefined): string | undefined {
  const h = (host ?? "").toLowerCase().split(":")[0];
  if (!h) return undefined;
  const root = platformRootDomain().toLowerCase();
  if (h === root || h.endsWith(`.${root}`)) return `.${root}`;
  return undefined;
}

/** True when the host is one of OUR canonical hostnames — never rewrite
 *  to /seller-host. */
export function isPlatformOwnHost(host: string): boolean {
  const h = host.toLowerCase().split(":")[0]!;
  const apex = platformRootDomain().toLowerCase();
  if (h === apex || h === `www.${apex}`) return true;
  if (h === appRootHost().toLowerCase()) return true;
  // Reserved app subdomains — these get path rewrites instead of seller lookup.
  if (h === `app.${apex}` || h === `admin.${apex}`) return true;
  // Common local dev hosts — never treated as a custom domain
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return true;
  return false;
}

/** What URL prefix a request on `app.invoxai.io` or `admin.invoxai.io`
 *  should map to internally. Returns null for other hosts. */
export function appHostPrefix(host: string): "/dashboard" | "/admin" | null {
  const h = host.toLowerCase().split(":")[0]!;
  const apex = platformRootDomain().toLowerCase();
  if (h === `app.${apex}`) return "/dashboard";
  if (h === `admin.${apex}`) return "/admin";
  return null;
}

/**
 * If the host is *.invoxai.io (or whatever our platform root is), return the
 * left-most label. We reject the reserved set so middleware can pass them
 * through to the dashboard / API routes.
 */
export function extractSubdomain(host: string): string | null {
  const h = host.toLowerCase().split(":")[0]!;
  const apex = platformRootDomain().toLowerCase();
  if (!h.endsWith(`.${apex}`)) return null;
  const label = h.slice(0, h.length - apex.length - 1); // strip ".invoxai.io"
  if (!label || label.includes(".")) return null; // we only own one level
  if (HARD_RESERVED_SUBDOMAINS.has(label)) return null;
  return label;
}

// ── Custom-domain hygiene ───────────────────────────────────────────────

const HOSTNAME_REGEX =
  /^(?=.{4,253}$)(([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)\.)+[a-z]{2,63}$/;

export function normaliseDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

export function validateDomain(input: string): {
  ok: boolean;
  message?: string;
} {
  const d = normaliseDomain(input);
  if (!d) return { ok: false, message: "Domain is required." };
  if (!HOSTNAME_REGEX.test(d)) {
    return { ok: false, message: "Invalid domain format." };
  }
  const apex = platformRootDomain().toLowerCase();
  if (d === apex || d.endsWith(`.${apex}`)) {
    return {
      ok: false,
      message:
        "Use the Subdomain field for *.invoxai.io domains — Custom Domain is for your own hostname.",
    };
  }
  return { ok: true };
}

// ── Redis cache keys ─────────────────────────────────────────────────────

export function hostLookupCacheKey(host: string): string {
  return `host_lookup:${host.toLowerCase()}`;
}

export const HOST_LOOKUP_TTL_SECONDS = 5 * 60;
