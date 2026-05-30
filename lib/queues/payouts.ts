// payoutQueue — wraps processPayoutJob from lib/payouts so the cron
// dispatcher can fan out work onto BullMQ workers instead of doing
// every payout inside its single HTTP request.

import type { Queue, Worker } from "bullmq";

export const PAYOUT_QUEUE_NAME = "payouts";

export interface PayoutJobData {
  payout_id: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __invoxaiPayoutQueue: Queue<PayoutJobData> | null | undefined;
  // eslint-disable-next-line no-var
  var __invoxaiPayoutWorker: Worker<PayoutJobData> | null | undefined;
}

function conn(): { url: string } | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return { url };
}

export async function enqueuePayout(payoutId: string): Promise<boolean> {
  const c = conn();
  if (!c) {
    void (async () => {
      try {
        const { processPayoutJob } = await import("@/lib/payouts");
        await processPayoutJob(payoutId);
      } catch (e) {
        console.error("[payout-queue] inline run failed", e);
      }
    })();
    return false;
  }
  if (global.__invoxaiPayoutQueue === undefined) {
    try {
      const { Queue } = await import("bullmq");
      global.__invoxaiPayoutQueue = new Queue<PayoutJobData>(
        PAYOUT_QUEUE_NAME,
        {
          connection: c,
          defaultJobOptions: {
            // Payouts are expensive — don't blast the gateway with retries.
            attempts: 3,
            backoff: { type: "exponential", delay: 120_000 },
            removeOnComplete: { count: 1000 },
            removeOnFail: { age: 30 * 24 * 60 * 60 },
          },
        },
      );
    } catch (e) {
      console.error("[payout-queue] init failed", e);
      global.__invoxaiPayoutQueue = null;
    }
  }
  if (!global.__invoxaiPayoutQueue) return false;
  await global.__invoxaiPayoutQueue.add(
    "process",
    { payout_id: payoutId },
    { jobId: `payout:${payoutId}` }, // dedup
  );
  return true;
}

export async function bootPayoutWorker(): Promise<void> {
  if (global.__invoxaiPayoutWorker !== undefined) return;
  const c = conn();
  if (!c) {
    global.__invoxaiPayoutWorker = null;
    return;
  }
  try {
    const { Worker } = await import("bullmq");
    const w = new Worker<PayoutJobData>(
      PAYOUT_QUEUE_NAME,
      async (job) => {
        const { processPayoutJob } = await import("@/lib/payouts");
        const res = await processPayoutJob(job.data.payout_id);
        if (!res.ok) throw new Error(res.message ?? "payout failed");
      },
      // Lower concurrency than emails — Razorpay/Cashfree have their own
      // rate limits.
      { connection: c, concurrency: 2 },
    );
    w.on("failed", (job, err) =>
      console.error(`[payout-worker] ${job?.id} failed:`, err?.message ?? err),
    );
    global.__invoxaiPayoutWorker = w;
    console.log("[payout-worker] started");
  } catch (e) {
    console.error("[payout-worker] start failed", e);
    global.__invoxaiPayoutWorker = null;
  }
}
