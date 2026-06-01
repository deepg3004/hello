import { describe, expect, it } from "vitest";

import {
  canCreateMorePages,
  effectiveCommissionPercent,
  minimumPlanForFeature,
  planHasFeature,
  resolveCommissionPercent,
} from "@/lib/plans";

describe("effectiveCommissionPercent", () => {
  it("applies no discount on free/pro", () => {
    expect(effectiveCommissionPercent("free", 5)).toBe(5);
    expect(effectiveCommissionPercent("pro", 5)).toBe(5);
  });
  it("subtracts the business discount", () => {
    // business has commission_discount: 2
    expect(effectiveCommissionPercent("business", 5)).toBe(3);
  });
  it("never returns a negative commission", () => {
    expect(effectiveCommissionPercent("business", 1)).toBe(0);
  });
});

describe("resolveCommissionPercent", () => {
  it("uses the admin per-plan override when present (absolute %)", () => {
    const map = { free: 5, starter: 4.5, pro: 3.5, business: 2.5 };
    expect(resolveCommissionPercent("pro", 5, map)).toBe(3.5);
    expect(resolveCommissionPercent("business", 5, map)).toBe(2.5);
  });
  it("falls back to the compiled discount when no map / no entry", () => {
    expect(resolveCommissionPercent("business", 5, null)).toBe(3); // 5 - 2
    expect(resolveCommissionPercent("business", 5, { free: 5 })).toBe(3);
  });
  it("clamps overrides to [0, 100]", () => {
    expect(resolveCommissionPercent("pro", 5, { pro: -2 })).toBe(0);
    expect(resolveCommissionPercent("pro", 5, { pro: 250 })).toBe(100);
  });
  it("ignores a non-finite override and falls back", () => {
    expect(resolveCommissionPercent("free", 5, { free: NaN })).toBe(5);
  });
});

describe("canCreateMorePages", () => {
  it("enforces the free-plan page cap (3)", () => {
    expect(canCreateMorePages("free", 2)).toBe(true);
    expect(canCreateMorePages("free", 3)).toBe(false);
  });
  it("treats -1 as unlimited", () => {
    expect(canCreateMorePages("pro", 9999)).toBe(true);
    expect(canCreateMorePages("business", 100000)).toBe(true);
  });
});

describe("plan feature inheritance", () => {
  it("business inherits lower-tier features", () => {
    // telegram_vip is a starter feature; business inherits via everything_pro
    expect(planHasFeature("business", "telegram_vip")).toBe(true);
    expect(planHasFeature("business", "affiliate_system")).toBe(true);
  });
  it("free lacks paid features", () => {
    expect(planHasFeature("free", "coupon_codes")).toBe(false);
    expect(planHasFeature("free", "basic_pages")).toBe(true);
  });
  it("reports the cheapest plan that unlocks a feature", () => {
    expect(minimumPlanForFeature("coupon_codes")).toBe("pro");
    expect(minimumPlanForFeature("telegram_vip")).toBe("starter");
    expect(minimumPlanForFeature("affiliate_system")).toBe("business");
  });
});
