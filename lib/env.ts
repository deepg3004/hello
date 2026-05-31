// =============================================================================
// lib/env.ts — centralised environment validation.
//
// Why this exists: on 2026-05-31 the live site spent ~4 hours throwing cryptic
// 500s because `NEXT_PUBLIC_SUPABASE_ANON_KEY` was empty in .env.production
// while every Supabase client still loaded "OK" thanks to `process.env.X!` non-
// null assertions. The first error surfaced deep inside @supabase/ssr as
// "Your project's URL and Key are required to create a Supabase client!"
// with no hint about which env var or where to look.
//
// `assertCriticalEnv()` is called once from instrumentation.ts at server boot.
// If anything is missing it logs a structured "[env] MISSING …" line that
// names the variable and the file to populate, then re-throws so PM2 marks
// the process unhealthy instead of accepting traffic that will 500.
//
// `getPublicEnv()` is the safe getter for read sites that previously did
// `process.env.NEXT_PUBLIC_SUPABASE_URL!` — it returns the value if set or
// throws a typed `EnvMissingError` with the same useful message.
// =============================================================================

export class EnvMissingError extends Error {
  constructor(public readonly varName: string, where: string) {
    super(
      `Missing required env var ${varName}. ` +
        `On the VPS this lives in /var/www/invoxai/.env.production (chmod 600). ` +
        `Used at: ${where}.`,
    );
    this.name = "EnvMissingError";
  }
}

interface EnvSpec {
  name: string;
  /** Where this is read — surfaced in the error so ops can find the call site. */
  where: string;
  /** Minimum value length sanity check (catches truncated pastes). */
  minLength?: number;
}

// The non-negotiable set. Anything not in here either has a working default
// or is optional (Telegram, Twilio, Cloudflare, Surepass, Cashfree, etc.).
const CRITICAL: EnvSpec[] = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    where: "lib/supabase/{server,client,admin}.ts, middleware.ts",
    minLength: 20,
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    where: "lib/supabase/{server,client}.ts, middleware.ts",
    minLength: 100, // anon JWT is typically ~208 chars
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    where: "lib/supabase/admin.ts (every admin server-side path)",
    minLength: 100, // service-role JWT is typically ~219 chars
  },
];

function readEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v : undefined;
}

/**
 * Run at server boot. Throws if any CRITICAL var is missing or implausibly
 * short. PM2 will surface the error in /var/log/invoxai/app.err.log with a
 * clear actionable message instead of a deep-stack @supabase/ssr trace.
 */
export function assertCriticalEnv(): void {
  const missing: string[] = [];
  const truncated: Array<{ name: string; got: number; want: number }> = [];

  for (const spec of CRITICAL) {
    const v = readEnv(spec.name);
    if (!v) {
      missing.push(spec.name);
      console.error(
        `[env] MISSING ${spec.name} — set it in /var/www/invoxai/.env.production. ` +
          `Used at: ${spec.where}`,
      );
      continue;
    }
    if (spec.minLength != null && v.length < spec.minLength) {
      truncated.push({ name: spec.name, got: v.length, want: spec.minLength });
      console.error(
        `[env] TRUNCATED ${spec.name} — got ${v.length} chars, expected >= ${spec.minLength}. ` +
          `Likely a truncated paste in .env.production. Used at: ${spec.where}`,
      );
    }
  }

  if (missing.length > 0 || truncated.length > 0) {
    const summary = [
      missing.length ? `missing=${missing.join(",")}` : null,
      truncated.length
        ? `truncated=${truncated.map((t) => `${t.name}(${t.got}/${t.want})`).join(",")}`
        : null,
    ]
      .filter(Boolean)
      .join(" ");
    throw new Error(`[env] boot check failed: ${summary}`);
  }
}

/**
 * Safe replacement for `process.env.NEXT_PUBLIC_X!`. Throws a typed error
 * with the file path so ops can locate the missing config fast.
 */
export function requireEnv(name: string, where: string): string {
  const v = readEnv(name);
  if (!v) throw new EnvMissingError(name, where);
  return v;
}
