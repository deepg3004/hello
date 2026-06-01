import { describe, expect, it } from "vitest";

import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

describe("clientIp", () => {
  it("takes the first x-forwarded-for entry", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip then 'unknown'", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-real-ip": "9.9.9.9" } }))).toBe("9.9.9.9");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});

describe("rateLimit", () => {
  it("fails open (allows) when Redis is unavailable", async () => {
    // No REDIS_URL in the test env → getRedis() returns null.
    const r = await rateLimit("test:key", 1, 60);
    expect(r.ok).toBe(true);
    expect(r.retryAfter).toBe(0);
  });
});

describe("tooManyRequests", () => {
  it("returns a 429 with a Retry-After header", async () => {
    const res = tooManyRequests(30);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(res.headers.get("content-type")).toContain("application/json");
  });
  it("never emits a Retry-After below 1", () => {
    expect(tooManyRequests(0).headers.get("retry-after")).toBe("1");
  });
});
