// telegramQueue — Telegram VIP lifecycle work.
//
// Two job names today:
//   kickMember       { membership_id }    — runs the Telegram cron's kick
//   sendInviteLink   { order_id }         — re-issues an invite (e.g. when
//                                            the buyer asks for it again)

import type { Queue, Worker } from "bullmq";

export const TELEGRAM_QUEUE_NAME = "telegram";

export type TelegramJobName = "kickMember" | "sendInviteLink";

export interface TelegramJobData {
  membership_id?: string;
  order_id?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __invoxaiTgQueue: Queue<TelegramJobData> | null | undefined;
  // eslint-disable-next-line no-var
  var __invoxaiTgWorker: Worker<TelegramJobData> | null | undefined;
}

function conn(): { url: string } | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return { url };
}

export async function enqueueKickMember(membershipId: string): Promise<boolean> {
  const c = conn();
  if (!c) return false;
  await ensureQueue();
  if (!global.__invoxaiTgQueue) return false;
  await global.__invoxaiTgQueue.add(
    "kickMember",
    { membership_id: membershipId },
    { jobId: `kick__${membershipId}` },
  );
  return true;
}

export async function enqueueSendInviteLink(orderId: string): Promise<boolean> {
  const c = conn();
  if (!c) return false;
  await ensureQueue();
  if (!global.__invoxaiTgQueue) return false;
  await global.__invoxaiTgQueue.add(
    "sendInviteLink",
    { order_id: orderId },
    { jobId: `invite__${orderId}` },
  );
  return true;
}

async function ensureQueue(): Promise<void> {
  if (global.__invoxaiTgQueue !== undefined) return;
  const c = conn();
  if (!c) {
    global.__invoxaiTgQueue = null;
    return;
  }
  try {
    const { Queue } = await import("bullmq");
    global.__invoxaiTgQueue = new Queue<TelegramJobData>(TELEGRAM_QUEUE_NAME, {
      connection: c,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 60_000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { age: 14 * 24 * 60 * 60 },
      },
    });
  } catch (e) {
    console.error("[telegram-queue] init failed", e);
    global.__invoxaiTgQueue = null;
  }
}

export async function bootTelegramWorker(): Promise<void> {
  if (global.__invoxaiTgWorker !== undefined) return;
  const c = conn();
  if (!c) {
    global.__invoxaiTgWorker = null;
    return;
  }
  try {
    const { Worker } = await import("bullmq");
    const w = new Worker<TelegramJobData>(
      TELEGRAM_QUEUE_NAME,
      async (job) => {
        const name = job.name as TelegramJobName;
        if (name === "kickMember" && job.data.membership_id) {
          // revokeMembershipAction handles the actual kick + DB flip.
          const { revokeMembershipAction } = await import("@/actions/telegram");
          const res = await revokeMembershipAction(job.data.membership_id);
          if (!res.ok) throw new Error(res.message ?? "revoke failed");
          return;
        }
        if (name === "sendInviteLink" && job.data.order_id) {
          const { issueInviteForOrder } = await import("@/actions/telegram");
          const res = await issueInviteForOrder(job.data.order_id);
          if (!res.ok) throw new Error(res.message ?? "invite failed");
          return;
        }
        throw new Error(`Unknown telegram job: ${name}`);
      },
      { connection: c, concurrency: 4 },
    );
    w.on("failed", (job, err) =>
      console.error(`[telegram-worker] ${job?.id} failed:`, err?.message ?? err),
    );
    global.__invoxaiTgWorker = w;
    console.log("[telegram-worker] started");
  } catch (e) {
    console.error("[telegram-worker] start failed", e);
    global.__invoxaiTgWorker = null;
  }
}
