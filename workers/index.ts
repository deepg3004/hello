// =============================================================================
// Standalone BullMQ worker process — run by PM2 in fork mode.
//
//   pm2 start ecosystem.config.js --only invoxai-workers
//
// We boot every queue worker the app exposes so the producer-only Next.js
// PM2 process (cluster mode) doesn't have to spin them up itself.
//
// Run order:
//   1. Load .env.production
//   2. Spawn each worker — they connect to Redis and start polling
//   3. Wire SIGINT / SIGTERM so PM2 can drain on reload
//
// This file is intentionally light — every queue lives in lib/queues/*.ts;
// the worker process just orchestrates their boot.
// =============================================================================

import path from "node:path";

// .env.local is loaded by Next.js automatically; for the standalone worker
// we have to do it ourselves. Use the same precedence Next does:
//   .env.production.local → .env.production → .env.local → .env
import { config as loadEnv } from "dotenv";
loadEnv({ path: path.join(process.cwd(), ".env.production.local") });
loadEnv({ path: path.join(process.cwd(), ".env.production") });
loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });

import { bootInvoiceWorker } from "@/lib/queues/invoices";
import { bootRecoveryWorker } from "@/lib/queues/recovery";
import { bootEmailWorker } from "@/lib/queues/email";
import { bootWhatsAppWorker } from "@/lib/queues/whatsapp";
import { bootPayoutWorker } from "@/lib/queues/payouts";
import { bootTelegramWorker } from "@/lib/queues/telegram";

async function main(): Promise<void> {
  if (!process.env.REDIS_URL) {
    console.warn(
      "[workers] REDIS_URL not set — every queue's worker will no-op.",
    );
  }

  console.log("[workers] starting…");
  await Promise.all([
    bootInvoiceWorker(),
    bootRecoveryWorker(),
    bootEmailWorker(),
    bootWhatsAppWorker(),
    bootPayoutWorker(),
    bootTelegramWorker(),
  ]);
  console.log("[workers] all workers booted");

  // PM2 sends SIGINT on reload — give workers a chance to finish in-flight
  // jobs before tearing the process down. PM2's kill_timeout is set to 8s
  // in ecosystem.config.js, so leave a 6s drain window.
  const shutdown = (signal: string): void => {
    console.log(`[workers] ${signal} received — exiting gracefully`);
    setTimeout(() => process.exit(0), 6_000);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((e) => {
  console.error("[workers] fatal", e);
  process.exit(1);
});
