// Invoice job queue + worker bootstrap.
//
// The verify-payment route pushes one job per paid order. A long-running
// worker (started from instrumentation.ts) drains the queue and calls
// generateInvoice(). If Redis isn't configured, enqueue() falls through to
// a fire-and-forget `void generateInvoice(orderId)` — useful in dev.
//
// Server-only — never import from a client component.

import type { Queue, Worker } from "bullmq";

export const INVOICE_QUEUE_NAME = "invoices";

interface InvoiceJobData {
  order_id: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __invoxaiInvoiceQueue: Queue<InvoiceJobData> | null | undefined;
  // eslint-disable-next-line no-var
  var __invoxaiInvoiceWorker: Worker<InvoiceJobData> | null | undefined;
}

function redisConnectionOpts(): { url: string } | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return { url };
}

/** Lazily construct the producer-side Queue. */
async function getQueue(): Promise<Queue<InvoiceJobData> | null> {
  if (global.__invoxaiInvoiceQueue !== undefined) {
    return global.__invoxaiInvoiceQueue;
  }
  const conn = redisConnectionOpts();
  if (!conn) {
    global.__invoxaiInvoiceQueue = null;
    return null;
  }
  try {
    const { Queue } = await import("bullmq");
    global.__invoxaiInvoiceQueue = new Queue<InvoiceJobData>(
      INVOICE_QUEUE_NAME,
      {
        connection: conn,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { age: 14 * 24 * 60 * 60 },
        },
      },
    );
    return global.__invoxaiInvoiceQueue;
  } catch (e) {
    console.error("[invoice-queue] init failed", e);
    global.__invoxaiInvoiceQueue = null;
    return null;
  }
}

/**
 * Push an "invoice this order" job. Returns true on enqueue, false on
 * fall-through (we ran it inline in the background).
 */
export async function enqueueInvoiceJob(orderId: string): Promise<boolean> {
  const queue = await getQueue();
  if (queue) {
    await queue.add(
      "generate",
      { order_id: orderId },
      { jobId: `invoice__${orderId}` }, // dedup (BullMQ forbids ':' in jobId)
    );
    return true;
  }
  // Fallback path — fire-and-forget. The caller already returned its response
  // so this happens off the critical path. We swallow all errors.
  void (async () => {
    try {
      const { generateInvoice } = await import("@/lib/invoice-generator");
      await generateInvoice(orderId);
    } catch (e) {
      console.error("[invoice-queue] inline generate failed", e);
    }
  })();
  return false;
}

/**
 * Boot the in-process Worker. Called from instrumentation.ts on Node startup.
 * No-ops on Edge runtime / when Redis is missing / when called twice.
 */
export async function bootInvoiceWorker(): Promise<void> {
  if (global.__invoxaiInvoiceWorker !== undefined) return;
  const conn = redisConnectionOpts();
  if (!conn) {
    global.__invoxaiInvoiceWorker = null;
    return;
  }
  try {
    const { Worker } = await import("bullmq");
    const w = new Worker<InvoiceJobData>(
      INVOICE_QUEUE_NAME,
      async (job) => {
        const { generateInvoice } = await import("@/lib/invoice-generator");
        const res = await generateInvoice(job.data.order_id);
        if (!res.ok) {
          throw new Error(res.message ?? "generateInvoice failed");
        }
        return res;
      },
      {
        connection: conn,
        concurrency: 2,
      },
    );
    w.on("failed", (job, err) => {
      console.error(
        `[invoice-worker] job ${job?.id} failed:`,
        err?.message ?? err,
      );
    });
    w.on("completed", (job) => {
      console.log(`[invoice-worker] job ${job.id} done`);
    });
    global.__invoxaiInvoiceWorker = w;
    console.log("[invoice-worker] started");
  } catch (e) {
    console.error("[invoice-worker] start failed", e);
    global.__invoxaiInvoiceWorker = null;
  }
}
