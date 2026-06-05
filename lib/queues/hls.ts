// HLS transcode job queue + worker. The course upload route pushes one job per
// uploaded video; the worker (booted in workers/index.ts) drains it and runs
// processHlsForPath(). Falls back to a fire-and-forget inline run when Redis is
// absent. Server-only.

import type { Queue, Worker } from "bullmq";

export const HLS_QUEUE_NAME = "hls";

interface HlsJobData {
  raw_path: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __invoxaiHlsQueue: Queue<HlsJobData> | null | undefined;
  // eslint-disable-next-line no-var
  var __invoxaiHlsWorker: Worker<HlsJobData> | null | undefined;
}

function redisConnectionOpts(): { url: string } | null {
  const url = process.env.REDIS_URL;
  return url ? { url } : null;
}

async function getQueue(): Promise<Queue<HlsJobData> | null> {
  if (global.__invoxaiHlsQueue !== undefined) return global.__invoxaiHlsQueue;
  const conn = redisConnectionOpts();
  if (!conn) {
    global.__invoxaiHlsQueue = null;
    return null;
  }
  try {
    const { Queue } = await import("bullmq");
    global.__invoxaiHlsQueue = new Queue<HlsJobData>(HLS_QUEUE_NAME, {
      connection: conn,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 60_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { age: 14 * 24 * 60 * 60 },
      },
    });
    return global.__invoxaiHlsQueue;
  } catch (e) {
    console.error("[hls-queue] init failed", e);
    global.__invoxaiHlsQueue = null;
    return null;
  }
}

/** Push a "transcode this upload to HLS" job (deduped by path). */
export async function enqueueHlsJob(rawPath: string): Promise<boolean> {
  const queue = await getQueue();
  if (queue) {
    await queue.add("transcode", { raw_path: rawPath }, { jobId: `hls__${rawPath.replace(/[^a-zA-Z0-9_-]/g, "_")}` });
    return true;
  }
  // No Redis → run inline in the background (off the request's critical path).
  void (async () => {
    try {
      const { processHlsForPath } = await import("@/lib/hls/process");
      await processHlsForPath(rawPath);
    } catch (e) {
      console.error("[hls-queue] inline transcode failed", e);
    }
  })();
  return false;
}

export async function bootHlsWorker(): Promise<void> {
  if (global.__invoxaiHlsWorker !== undefined) return;
  const conn = redisConnectionOpts();
  if (!conn) {
    global.__invoxaiHlsWorker = null;
    return;
  }
  try {
    const { Worker } = await import("bullmq");
    const w = new Worker<HlsJobData>(
      HLS_QUEUE_NAME,
      async (job) => {
        const { processHlsForPath } = await import("@/lib/hls/process");
        await processHlsForPath(job.data.raw_path);
      },
      // Transcoding is CPU-heavy — one at a time, generous lock for long videos.
      { connection: conn, concurrency: 1, lockDuration: 10 * 60_000 },
    );
    w.on("failed", (job, err) => {
      console.error(`[hls-worker] job ${job?.id} failed:`, err?.message ?? err);
    });
    global.__invoxaiHlsWorker = w;
    console.log("[hls-worker] started");
  } catch (e) {
    console.error("[hls-worker] start failed", e);
    global.__invoxaiHlsWorker = null;
  }
}
