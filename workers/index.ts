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

// @supabase/supabase-js (>=2.106) eagerly constructs a RealtimeClient that
// needs a global WebSocket. Next provides one in the app runtime, but this
// standalone worker runs under tsx with none — so every createAdminClient()
// (recovery, invoices, queued email, …) throws "Node.js 20 without native
// WebSocket". Polyfill it from `ws` before any Supabase client is built.
import WS from "ws";
if (!(globalThis as { WebSocket?: unknown }).WebSocket) {
  (globalThis as { WebSocket?: unknown }).WebSocket = WS;
}

import { bootInvoiceWorker } from "@/lib/queues/invoices";
import { bootHlsWorker } from "@/lib/queues/hls";
import { bootRecoveryWorker } from "@/lib/queues/recovery";
import { bootEmailWorker } from "@/lib/queues/email";
import { bootWhatsAppWorker } from "@/lib/queues/whatsapp";
import { bootTelegramWorker } from "@/lib/queues/telegram";
import { bootTelegramSyncLoop } from "@/lib/queues/telegram-sync";

async function main(): Promise<void> {
  if (!process.env.REDIS_URL) {
    console.warn(
      "[workers] REDIS_URL not set — every queue's worker will no-op.",
    );
  }

  console.log("[workers] starting…");
  // Prime email branding (platform name + logo) for queued sends.
  try {
    const { primeEmailBranding } = await import("@/lib/emails/branding");
    await primeEmailBranding(true);
  } catch {
    /* non-fatal — emails fall back to default branding */
  }
  await Promise.all([
    bootInvoiceWorker(),
    bootHlsWorker(),
    bootRecoveryWorker(),
    bootEmailWorker(),
    bootWhatsAppWorker(),
    bootTelegramWorker(),
  ]);
  // 1-minute Telegram join/leave reconcile (not a BullMQ queue — a timer loop).
  bootTelegramSyncLoop();
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
