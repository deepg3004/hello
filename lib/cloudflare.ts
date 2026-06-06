// =============================================================================
// Cloudflare client — DNS CRUD + DoH lookups.
//
// Server-only. Fails-soft when credentials aren't configured so dev rigs
// without Cloudflare access can still drive the rest of the domain flow.
// =============================================================================

const CF_API = "https://api.cloudflare.com/client/v4";

export interface CloudflareConfig {
  apiToken: string;
  zoneId: string;
}

function readConfig(): CloudflareConfig | null {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!apiToken || !zoneId) return null;
  return { apiToken, zoneId };
}

interface CfResponse<T> {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  messages?: Array<{ message: string }>;
  result?: T;
}

export interface CreateCnameInput {
  name: string;
  target: string;
  proxied?: boolean;
  comment?: string;
}

export interface CloudflareResult<T> {
  ok: boolean;
  data?: T;
  message?: string;
  skipped?: boolean;
}

/**
 * Create or update a CNAME on the platform zone — used for subdomain claims.
 * Idempotent: if a record already exists for the same name+type, we replace
 * it in-place so re-running the claim doesn't fail noisy.
 */
export async function upsertCname(
  input: CreateCnameInput,
): Promise<CloudflareResult<{ id: string }>> {
  const cfg = readConfig();
  if (!cfg) {
    console.warn("[cloudflare] CLOUDFLARE_API_TOKEN/ZONE_ID not set", input);
    return { ok: true, skipped: true };
  }
  try {
    // Find an existing record with the same name.
    const existing = await cfFetch<
      Array<{ id: string; name: string; type: string }>
    >(`/zones/${cfg.zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(input.name)}`, {
      method: "GET",
      token: cfg.apiToken,
    });
    const existingId = existing.ok ? existing.data?.[0]?.id : undefined;

    const body = {
      type: "CNAME",
      name: input.name,
      content: input.target,
      ttl: 1, // 'automatic'
      proxied: input.proxied ?? true,
      comment: input.comment ?? "invoxai-managed",
    };

    if (existingId) {
      const updated = await cfFetch<{ id: string }>(
        `/zones/${cfg.zoneId}/dns_records/${existingId}`,
        { method: "PUT", token: cfg.apiToken, body },
      );
      return updated;
    }

    return await cfFetch<{ id: string }>(
      `/zones/${cfg.zoneId}/dns_records`,
      { method: "POST", token: cfg.apiToken, body },
    );
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteRecord(
  recordId: string,
): Promise<CloudflareResult<unknown>> {
  const cfg = readConfig();
  if (!cfg) return { ok: true, skipped: true };
  return cfFetch(`/zones/${cfg.zoneId}/dns_records/${recordId}`, {
    method: "DELETE",
    token: cfg.apiToken,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// DNS-over-HTTPS lookup (used to verify a seller's custom-domain CNAME)
// ─────────────────────────────────────────────────────────────────────────

export interface DohRecord {
  name: string;
  type: number; // 1=A, 5=CNAME
  TTL: number;
  data: string;
}

/**
 * Edge-safe DoH lookup against Cloudflare's 1.1.1.1 — works in middleware
 * and in route handlers without pulling node:dns.
 */
export async function dohLookup(
  name: string,
  type: "A" | "CNAME" = "CNAME",
): Promise<{ ok: boolean; records: DohRecord[]; message?: string }> {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
      name,
    )}&type=${type}`;
    const res = await fetch(url, {
      headers: { accept: "application/dns-json" },
    });
    if (!res.ok) {
      return { ok: false, records: [], message: `DoH HTTP ${res.status}` };
    }
    const body = (await res.json()) as { Answer?: DohRecord[] };
    return { ok: true, records: body.Answer ?? [] };
  } catch (e) {
    return {
      ok: false,
      records: [],
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Walk a CNAME chain (up to 5 hops) to discover the final hostname or A
 * record. Returns the target we found a match against, plus the full chain
 * for debugging.
 */
export async function resolveCnameChain(
  hostname: string,
  expectedTarget: string,
  maxHops = 5,
): Promise<{ matched: boolean; chain: string[]; final: string | null }> {
  const chain: string[] = [];
  let current = hostname.toLowerCase().replace(/\.$/, "");
  const want = expectedTarget.toLowerCase().replace(/\.$/, "");
  for (let i = 0; i < maxHops; i++) {
    const { records } = await dohLookup(current, "CNAME");
    const next = records[0]?.data?.toLowerCase().replace(/\.$/, "");
    if (!next) break;
    chain.push(next);
    if (next === want) {
      return { matched: true, chain, final: next };
    }
    current = next;
  }

  // Apex fallback. A root domain (e.g. "invoxai.shop") can't hold a CNAME per
  // RFC 1034, so providers expose an ALIAS/ANAME/flattened record that answers
  // as A records instead — meaning the CNAME walk above finds nothing. Treat
  // the domain as pointing at us when its A records resolve to the same IPs as
  // the expected target (our Cloudflare ingress for hello.invoxai.io).
  const [hostA, targetA] = await Promise.all([
    dohLookup(current, "A"),
    dohLookup(want, "A"),
  ]);
  const targetIps = targetA.records
    .filter((r) => r.type === 1)
    .map((r) => r.data);
  const hostIps = new Set(
    hostA.records.filter((r) => r.type === 1).map((r) => r.data),
  );
  if (targetIps.length > 0 && targetIps.some((ip) => hostIps.has(ip))) {
    return { matched: true, chain: [...chain, `${current} A→${want}`], final: want };
  }

  return { matched: false, chain, final: chain[chain.length - 1] ?? null };
}

/** Resolve a hostname's A records (IPv4 strings) via DoH. Empty on failure. */
export async function resolveARecords(hostname: string): Promise<string[]> {
  const { records } = await dohLookup(
    hostname.toLowerCase().replace(/\.$/, ""),
    "A",
  );
  return records.filter((r) => r.type === 1).map((r) => r.data);
}

// ─────────────────────────────────────────────────────────────────────────
// Custom-hostname provisioning (Cloudflare for SaaS) — best-effort
// ─────────────────────────────────────────────────────────────────────────

// Raw shape of a Cloudflare custom_hostname object (only the bits we read).
interface CfCustomHostname {
  id: string;
  hostname: string;
  status?: string; // active | pending | ...
  ssl?: {
    status?: string; // pending_validation | pending_deployment | active | ...
    validation_records?: Array<{
      txt_name?: string;
      txt_value?: string;
      http_url?: string;
      http_body?: string;
    }>;
    validation_errors?: Array<{ message?: string }>;
  };
  ownership_verification?: { type?: string; name?: string; value?: string };
  ownership_verification_http?: { http_url?: string; http_body?: string };
}

export interface CustomHostnameResult {
  id: string;
  status: string;
  certStatus: "pending" | "provisioning" | "active" | "failed";
  dcv: DcvRecord[];
  error: string | null;
}

/** A domain-control-validation record the seller must add to issue the cert. */
export interface DcvRecord {
  type: "txt" | "cname";
  name: string;
  value: string;
}

/** Map a Cloudflare ssl/hostname status onto our 4-state cert lifecycle. */
function mapCertStatus(
  ch: CfCustomHostname,
): "pending" | "provisioning" | "active" | "failed" {
  const ssl = (ch.ssl?.status ?? "").toLowerCase();
  if (ssl === "active") return "active";
  if ((ch.ssl?.validation_errors?.length ?? 0) > 0) return "failed";
  if (ssl.startsWith("pending") || ssl === "initializing" || ssl === "deleted")
    return "provisioning";
  if (ssl) return "provisioning";
  return "pending";
}

/** Pull the seller-actionable DCV records out of a custom_hostname object. */
function extractDcv(ch: CfCustomHostname): DcvRecord[] {
  const out: DcvRecord[] = [];
  for (const rec of ch.ssl?.validation_records ?? []) {
    if (rec.txt_name && rec.txt_value) {
      out.push({ type: "txt", name: rec.txt_name, value: rec.txt_value });
    }
  }
  // Pre-validation hostname ownership check (CNAME/TXT) some plans require.
  const ov = ch.ownership_verification;
  if (ov?.name && ov.value) {
    const t = (ov.type ?? "txt").toLowerCase() === "cname" ? "cname" : "txt";
    out.push({ type: t, name: ov.name, value: ov.value });
  }
  return out;
}

function shapeCustomHostname(ch: CfCustomHostname): CustomHostnameResult {
  return {
    id: ch.id,
    status: ch.status ?? "",
    certStatus: mapCertStatus(ch),
    dcv: extractDcv(ch),
    error: ch.ssl?.validation_errors?.[0]?.message ?? null,
  };
}

/**
 * Register a seller's domain with our Cloudflare for SaaS zone so CF will
 * mint a Let's Encrypt cert for it. No-ops when CF for SaaS isn't on the
 * plan (operator runs cert-manager on the VPS instead).
 */
export async function provisionCustomHostname(
  hostname: string,
): Promise<CloudflareResult<CustomHostnameResult>> {
  const cfg = readConfig();
  if (!cfg) return { ok: true, skipped: true };
  const res = await cfFetch<CfCustomHostname>(
    `/zones/${cfg.zoneId}/custom_hostnames`,
    {
      method: "POST",
      token: cfg.apiToken,
      body: {
        hostname,
        ssl: {
          method: "txt",
          type: "dv",
          settings: { min_tls_version: "1.2" },
        },
      },
    },
  );
  if (res.ok && res.data) {
    return { ok: true, data: shapeCustomHostname(res.data) };
  }
  return { ok: res.ok, message: res.message, skipped: res.skipped };
}

/**
 * Read back the current state of a seller's custom hostname (cert status +
 * any DCV records still outstanding). Used to poll provisioning → active.
 */
export async function getCustomHostname(
  hostname: string,
): Promise<CloudflareResult<CustomHostnameResult | null>> {
  const cfg = readConfig();
  if (!cfg) return { ok: true, skipped: true };
  const res = await cfFetch<CfCustomHostname[]>(
    `/zones/${cfg.zoneId}/custom_hostnames?hostname=${encodeURIComponent(
      hostname,
    )}`,
    { method: "GET", token: cfg.apiToken },
  );
  if (!res.ok) return { ok: false, message: res.message };
  const ch = res.data?.[0];
  return { ok: true, data: ch ? shapeCustomHostname(ch) : null };
}

// ── Internal ────────────────────────────────────────────────────────────

async function cfFetch<T>(
  path: string,
  opts: {
    method: "GET" | "POST" | "PUT" | "DELETE";
    token: string;
    body?: Record<string, unknown>;
  },
): Promise<CloudflareResult<T>> {
  try {
    const res = await fetch(`${CF_API}${path}`, {
      method: opts.method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${opts.token}`,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as CfResponse<T>;
    if (!res.ok || !json.success) {
      const message =
        json.errors?.[0]?.message ??
        json.messages?.[0]?.message ??
        `Cloudflare HTTP ${res.status}`;
      return { ok: false, message };
    }
    return { ok: true, data: json.result };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
