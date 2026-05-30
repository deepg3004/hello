// =============================================================================
// emailQueue — fire-and-forget Resend sends.
//
// Producer side is intentionally tiny: callers usually use lib/emails/send.ts
// directly. The queue lets workers handle retries with exponential backoff
// when Resend is throttled / having a bad minute.
// =============================================================================

import type { Queue, Worker } from "bullmq";

import type { TemplateDataMap, TemplateKey } from "@/lib/emails/send";

export const EMAIL_QUEUE_NAME = "emails";

export interface EmailJobData {
  template: TemplateKey;
  to: string;
  data: TemplateDataMap[TemplateKey];
  tags?: Array<{ name: string; value: string }>;
  reply_to?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __invoxaiEmailQueue: Queue<EmailJobData> | null | undefined;
  // eslint-disable-next-line no-var
  var __invoxaiEmailWorker: Worker<EmailJobData> | null | undefined;
}

function conn(): { url: string } | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return { url };
}

export async function enqueueEmail(job: EmailJobData): Promise<boolean> {
  const c = conn();
  if (!c) {
    // Inline fallback so dev rigs without Redis still send.
    void (async () => {
      try {
        const { sendEmail } = await import("@/lib/emails/send");
        await sendEmail(job.template, job.to, job.data, {
          tags: job.tags,
          reply_to: job.reply_to,
        });
      } catch (e) {
        console.error("[email-queue] inline send failed", e);
      }
    })();
    return false;
  }
  if (global.__invoxaiEmailQueue === undefined) {
    try {
      const { Queue } = await import("bullmq");
      global.__invoxaiEmailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
        connection: c,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { age: 14 * 24 * 60 * 60 },
        },
      });
    } catch (e) {
      console.error("[email-queue] init failed", e);
      global.__invoxaiEmailQueue = null;
    }
  }
  if (!global.__invoxaiEmailQueue) return false;
  await global.__invoxaiEmailQueue.add("send", job);
  return true;
}

export async function bootEmailWorker(): Promise<void> {
  if (global.__invoxaiEmailWorker !== undefined) return;
  const c = conn();
  if (!c) {
    global.__invoxaiEmailWorker = null;
    return;
  }
  try {
    const { Worker } = await import("bullmq");
    const w = new Worker<EmailJobData>(
      EMAIL_QUEUE_NAME,
      async (job) => {
        const { sendEmail } = await import("@/lib/emails/send");
        const res = await sendEmail(
          job.data.template,
          job.data.to,
          job.data.data,
          { tags: job.data.tags, reply_to: job.data.reply_to },
        );
        if (!res.ok) {
          throw new Error(res.message ?? "Resend failed");
        }
      },
      { connection: c, concurrency: 5 },
    );
    w.on("failed", (job, err) =>
      console.error(`[email-worker] ${job?.id} failed:`, err?.message ?? err),
    );
    global.__invoxaiEmailWorker = w;
    console.log("[email-worker] started");
  } catch (e) {
    console.error("[email-worker] start failed", e);
    global.__invoxaiEmailWorker = null;
  }
}
