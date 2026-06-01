// Fixed-window rate limiter backed by Redis (ioredis). Atomic via INCR, with
// EXPIRE set on the first hit of each window. **Fails open** — if Redis is
// unavailable the request is allowed, so a Redis outage never takes down auth
// or checkout. Limit choices follow the documented policy (audit #12/#13).

import { getRedis } from "@/lib/redis";

/** Best-effort client IP from the proxy headers. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (only meaningful when !ok). */
  retryAfter: number;
}

/**
 * Allow up to `limit` requests per `windowSec` for `key`.
 * Returns { ok:false, retryAfter } once the limit is exceeded.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return { ok: true, retryAfter: 0 };
  const rk = `rl:${key}`;
  try {
    const n = await redis.incr(rk);
    if (n === 1) await redis.expire(rk, windowSec);
    if (n > limit) {
      const ttl = await redis.ttl(rk);
      return { ok: false, retryAfter: ttl > 0 ? ttl : windowSec };
    }
    return { ok: true, retryAfter: 0 };
  } catch {
    return { ok: true, retryAfter: 0 }; // fail open
  }
}

/** Standard 429 JSON response with a Retry-After header. */
export function tooManyRequests(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please slow down and try again shortly." }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(Math.max(1, retryAfter)),
      },
    },
  );
}
