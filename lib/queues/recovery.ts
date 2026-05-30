// =============================================================================
// Cart recovery queue — 4 sequenced jobs per abandoned checkout.
//
//   1. sendRecoveryEmail1        T + 30 min
//   2. sendRecoveryWhatsApp      T + 2 h
//   3. sendRecoveryEmail2        T + 24 h   (with optional discount coupon)
//   4. expireAbandonedCheckout   T + 72 h
//
// On a successful payment (verify-payment) we look up the stored BullMQ
// job ids and remove them so the recovery messages don't fire after
// the buyer's already converted.
//
// Server-only. Lazily imports bullmq so client/edge bundlers stay happy.
// =============================================================================

import type { Queue, Worker, JobsOptions } from "bullmq";

export const RECOVERY_QUEUE_NAME = "cart_recovery";

export type RecoveryJobName =
  | "sendRecoveryEmail1"
  | "sendRecoveryWhatsApp"
  | "sendRecoveryEmail2"
  | "expireAbandonedCheckout";

export interface RecoveryJobData {
  abandoned_id: string;
}

export interface RecoveryJobIds {
  email1?: string;
  whatsapp?: string;
  email2?: string;
  expire?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __invoxaiRecoveryQueue: Queue<RecoveryJobData> | null | undefined;
  // eslint-disable-next-line no-var
  var __invoxaiRecoveryWorker: Worker<RecoveryJobData> | null | undefined;
}

function redisConnectionOpts(): { url: string } | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return { url };
}

async function getQueue(): Promise<Queue<RecoveryJobData> | null> {
  if (global.__invoxaiRecoveryQueue !== undefined) {
    return global.__invoxaiRecoveryQueue;
  }
  const conn = redisConnectionOpts();
  if (!conn) {
    global.__invoxaiRecoveryQueue = null;
    return null;
  }
  try {
    const { Queue } = await import("bullmq");
    global.__invoxaiRecoveryQueue = new Queue<RecoveryJobData>(
      RECOVERY_QUEUE_NAME,
      {
        connection: conn,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 60_000 },
          removeOnComplete: { count: 2000 },
          removeOnFail: { age: 14 * 24 * 60 * 60 },
        },
      },
    );
    return global.__invoxaiRecoveryQueue;
  } catch (e) {
    console.error("[recovery-queue] init failed", e);
    global.__invoxaiRecoveryQueue = null;
    return null;
  }
}

// ----------------------------------------------------------------------------
// Schedule helpers
// ----------------------------------------------------------------------------

const DELAYS_MS: Record<RecoveryJobName, number> = {
  sendRecoveryEmail1: 30 * 60 * 1000,
  sendRecoveryWhatsApp: 2 * 60 * 60 * 1000,
  sendRecoveryEmail2: 24 * 60 * 60 * 1000,
  expireAbandonedCheckout: 72 * 60 * 60 * 1000,
};

/**
 * Push the full 4-job recovery sequence for a single abandoned checkout.
 * Returns the BullMQ job ids so the caller can persist them.
 * Returns null when Redis isn't configured (caller decides on a fallback —
 * the inline fallback uses setTimeout in-process, see scheduleRecoveryInline).
 */
export async function scheduleRecovery(
  abandonedId: string,
): Promise<RecoveryJobIds | null> {
  const queue = await getQueue();
  if (!queue) return null;

  const jobOpts = (delay: number, jobName: string): JobsOptions => ({
    delay,
    // jobId keeps the schedule idempotent for the same abandoned cart.
    // BullMQ rejects colons in jobIds (reserved for internal key structure),
    // so we use a double underscore as the separator.
    jobId: `${jobName}__${abandonedId}`,
  });

  const e1 = await queue.add(
    "sendRecoveryEmail1",
    { abandoned_id: abandonedId },
    jobOpts(DELAYS_MS.sendRecoveryEmail1, "rcv_e1"),
  );
  const wa = await queue.add(
    "sendRecoveryWhatsApp",
    { abandoned_id: abandonedId },
    jobOpts(DELAYS_MS.sendRecoveryWhatsApp, "rcv_wa"),
  );
  const e2 = await queue.add(
    "sendRecoveryEmail2",
    { abandoned_id: abandonedId },
    jobOpts(DELAYS_MS.sendRecoveryEmail2, "rcv_e2"),
  );
  const ex = await queue.add(
    "expireAbandonedCheckout",
    { abandoned_id: abandonedId },
    jobOpts(DELAYS_MS.expireAbandonedCheckout, "rcv_ex"),
  );

  return {
    email1: e1.id?.toString(),
    whatsapp: wa.id?.toString(),
    email2: e2.id?.toString(),
    expire: ex.id?.toString(),
  };
}

/**
 * Cancel every scheduled recovery job for this cart. Called on payment
 * success. Best-effort — silently ignores missing jobs (already fired or
 * already removed). Returns the count of jobs we successfully removed.
 */
export async function cancelRecovery(jobIds: RecoveryJobIds): Promise<number> {
  const queue = await getQueue();
  if (!queue) return 0;
  let removed = 0;
  for (const id of [jobIds.email1, jobIds.whatsapp, jobIds.email2, jobIds.expire]) {
    if (!id) continue;
    try {
      const job = await queue.getJob(id);
      if (job) {
        await job.remove();
        removed += 1;
      }
    } catch {
      /* not in queue / already executed — fine */
    }
  }
  return removed;
}

// ----------------------------------------------------------------------------
// Worker — drains the queue + dispatches to the right handler
// ----------------------------------------------------------------------------

export async function bootRecoveryWorker(): Promise<void> {
  if (global.__invoxaiRecoveryWorker !== undefined) return;
  const conn = redisConnectionOpts();
  if (!conn) {
    global.__invoxaiRecoveryWorker = null;
    return;
  }
  try {
    const { Worker } = await import("bullmq");
    const w = new Worker<RecoveryJobData>(
      RECOVERY_QUEUE_NAME,
      async (job) => {
        const handlers = await import("@/lib/recovery-runner");
        switch (job.name as RecoveryJobName) {
          case "sendRecoveryEmail1":
            return handlers.runSendRecoveryEmail1(job.data.abandoned_id);
          case "sendRecoveryWhatsApp":
            return handlers.runSendRecoveryWhatsApp(job.data.abandoned_id);
          case "sendRecoveryEmail2":
            return handlers.runSendRecoveryEmail2(job.data.abandoned_id);
          case "expireAbandonedCheckout":
            return handlers.runExpireAbandonedCheckout(job.data.abandoned_id);
          default:
            throw new Error(`Unknown recovery job: ${job.name}`);
        }
      },
      {
        connection: conn,
        concurrency: 4,
      },
    );
    w.on("failed", (job, err) => {
      console.error(
        `[recovery-worker] job ${job?.name} ${job?.id} failed:`,
        err?.message ?? err,
      );
    });
    w.on("completed", (job) => {
      console.log(`[recovery-worker] ${job.name} ${job.id} done`);
    });
    global.__invoxaiRecoveryWorker = w;
    console.log("[recovery-worker] started");
  } catch (e) {
    console.error("[recovery-worker] start failed", e);
    global.__invoxaiRecoveryWorker = null;
  }
}
