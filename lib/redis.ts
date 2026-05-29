// Singleton ioredis client. Returns null in environments that don't have
// REDIS_URL set so callers can degrade gracefully (Redis-only features like
// atomic coupon counters fall back to a DB-only path).

import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var __invoxaiRedis: Redis | null | undefined;
}

export function getRedis(): Redis | null {
  if (typeof global.__invoxaiRedis !== "undefined") return global.__invoxaiRedis;
  const url = process.env.REDIS_URL;
  if (!url) {
    global.__invoxaiRedis = null;
    return null;
  }
  try {
    global.__invoxaiRedis = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    return global.__invoxaiRedis;
  } catch {
    global.__invoxaiRedis = null;
    return null;
  }
}
