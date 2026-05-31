// Next.js 14 instrumentation hook — runs once on Node.js server startup.
// We use it to spin up background workers (BullMQ).
//
// Webpack will try to statically follow any `import("…")` from this file —
// which pulls puppeteer/bullmq into the edge bundle and breaks the build.
// To dodge that we resolve the queue module *at runtime* using
// `eval("require")`, which webpack can't see.

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

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = eval("require") as (m: string) => unknown;
    const invoices = req("./lib/queues/invoices") as {
      bootInvoiceWorker?: () => Promise<void>;
    };
    if (invoices.bootInvoiceWorker) await invoices.bootInvoiceWorker();

    const recovery = req("./lib/queues/recovery") as {
      bootRecoveryWorker?: () => Promise<void>;
    };
    if (recovery.bootRecoveryWorker) await recovery.bootRecoveryWorker();
  } catch (e) {
    console.error("[instrumentation] worker boot failed", e);
  }
}
