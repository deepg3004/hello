// Next.js 14 instrumentation hook — runs once on Node.js server startup.
// We use it to spin up background workers (BullMQ).
//
// Webpack will try to statically follow any `import("…")` from this file —
// which pulls puppeteer/bullmq into the edge bundle and breaks the build.
// To dodge that we resolve the queue module *at runtime* using
// `eval("require")`, which webpack can't see.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = eval("require") as (m: string) => unknown;
    const mod = req("./lib/queues/invoices") as {
      bootInvoiceWorker?: () => Promise<void>;
    };
    if (mod.bootInvoiceWorker) await mod.bootInvoiceWorker();
  } catch (e) {
    console.error("[instrumentation] worker boot failed", e);
  }
}
