// whatsappQueue — Twilio WhatsApp sends with retry backoff.

import type { Queue, Worker } from "bullmq";

import type { WaTemplateName } from "@/lib/twilio";

export const WA_QUEUE_NAME = "whatsapp";

export interface WhatsAppJobData {
  to: string;
  template: WaTemplateName | string;
  variables?: string[];
}

declare global {
  // eslint-disable-next-line no-var
  var __invoxaiWaQueue: Queue<WhatsAppJobData> | null | undefined;
  // eslint-disable-next-line no-var
  var __invoxaiWaWorker: Worker<WhatsAppJobData> | null | undefined;
}

function conn(): { url: string } | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return { url };
}

export async function enqueueWhatsApp(job: WhatsAppJobData): Promise<boolean> {
  const c = conn();
  if (!c) {
    void (async () => {
      try {
        const { sendWhatsApp } = await import("@/lib/twilio");
        await sendWhatsApp(job.to, job.template, job.variables);
      } catch (e) {
        console.error("[wa-queue] inline send failed", e);
      }
    })();
    return false;
  }
  if (global.__invoxaiWaQueue === undefined) {
    try {
      const { Queue } = await import("bullmq");
      global.__invoxaiWaQueue = new Queue<WhatsAppJobData>(WA_QUEUE_NAME, {
        connection: c,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { age: 14 * 24 * 60 * 60 },
        },
      });
    } catch (e) {
      console.error("[wa-queue] init failed", e);
      global.__invoxaiWaQueue = null;
    }
  }
  if (!global.__invoxaiWaQueue) return false;
  await global.__invoxaiWaQueue.add("send", job);
  return true;
}

export async function bootWhatsAppWorker(): Promise<void> {
  if (global.__invoxaiWaWorker !== undefined) return;
  const c = conn();
  if (!c) {
    global.__invoxaiWaWorker = null;
    return;
  }
  try {
    const { Worker } = await import("bullmq");
    const w = new Worker<WhatsAppJobData>(
      WA_QUEUE_NAME,
      async (job) => {
        const { sendWhatsApp } = await import("@/lib/twilio");
        const res = await sendWhatsApp(
          job.data.to,
          job.data.template,
          job.data.variables,
        );
        if (!res.ok && !res.skipped) throw new Error(res.message ?? "WA failed");
      },
      { connection: c, concurrency: 5 },
    );
    w.on("failed", (job, err) =>
      console.error(`[wa-worker] ${job?.id} failed:`, err?.message ?? err),
    );
    global.__invoxaiWaWorker = w;
    console.log("[wa-worker] started");
  } catch (e) {
    console.error("[wa-worker] start failed", e);
    global.__invoxaiWaWorker = null;
  }
}
