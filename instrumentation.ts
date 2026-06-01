// Next.js 14 instrumentation hook — runs once on Node.js server startup.
// Used only for fail-fast env validation.
//
// NOTE: BullMQ workers are deliberately NOT booted here. `invoxai-app` runs in
// PM2 cluster mode (multiple instances), so booting workers in-process would
// make every queued job run once per instance — duplicate invoices, emails,
// payouts, etc. All queue workers live in the dedicated single fork-mode
// `invoxai-workers` process (workers/index.ts, see ecosystem.config.js).
// The old in-process boot also never actually worked: the runtime
// `require("./lib/queues/invoices")` resolved relative to .next/server and
// always threw MODULE_NOT_FOUND, spamming app.err.log on every boot.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // CRITICAL env check — fails fast at boot with a CLEAR, actionable error
  // instead of letting requests trickle in and 500 deep inside @supabase/ssr.
  // If this throws, PM2 will surface the message in /var/log/invoxai/app.err.log
  // naming the missing/truncated variable AND the .env.production path. See
  // lib/env.ts header for the 2026-05-31 outage that motivated this.
  try {
    const { assertCriticalEnv } = await import("./lib/env");
    assertCriticalEnv();
  } catch (e) {
    console.error("[instrumentation] env validation failed", e);
    // Re-throw so PM2 marks the process unhealthy; don't accept traffic.
    throw e;
  }

  // Prime email branding (platform name + logo) so transactional emails carry
  // the live brand. Fire-and-forget — never block or fail startup on it.
  void import("./lib/emails/branding")
    .then((m) => m.primeEmailBranding(true))
    .catch(() => {});
}
