import { describe, expect, it } from "vitest";

import { computeDiscount, refundReversal } from "@/lib/pricing";

describe("computeDiscount", () => {
  it("applies a percentage discount", () => {
    expect(computeDiscount("percentage", 10, 1000, null)).toBe(100);
    expect(computeDiscount("percentage", 25, 200, null)).toBe(50);
  });

  it("applies a fixed discount", () => {
    expect(computeDiscount("fixed", 150, 1000, null)).toBe(150);
  });

  it("caps a percentage discount at max_discount", () => {
    // 50% of 1000 = 500, capped to 200
    expect(computeDiscount("percentage", 50, 1000, 200)).toBe(200);
  });

  it("never discounts more than the order amount", () => {
    expect(computeDiscount("fixed", 5000, 800, null)).toBe(800);
    expect(computeDiscount("percentage", 200, 100, null)).toBe(100);
  });

  it("rounds percentage discounts to 2 decimals", () => {
    // 33% of 99.99 = 32.9967 -> 33.00
    expect(computeDiscount("percentage", 33, 99.99, null)).toBe(33);
  });

  it("returns 0 for a 0% / 0-value discount", () => {
    expect(computeDiscount("percentage", 0, 1000, null)).toBe(0);
    expect(computeDiscount("fixed", 0, 1000, null)).toBe(0);
  });
});

describe("refundReversal", () => {
  it("reverses the full split on a full refund", () => {
    // gross 1000, seller 900, commission 100, refund 1000 → all of it
    expect(refundReversal(1000, 900, 100, 1000)).toEqual({
      fraction: 1,
      sellerReversal: 900,
      commissionGiveback: 100,
    });
  });

  it("reverses proportionally on a partial refund", () => {
    // refund 250 of 1000 = 25% → seller 225, commission 25
    expect(refundReversal(1000, 900, 100, 250)).toEqual({
      fraction: 0.25,
      sellerReversal: 225,
      commissionGiveback: 25,
    });
  });

  it("rounds to 2 decimals", () => {
    const r = refundReversal(999, 899.1, 99.9, 333);
    expect(r.sellerReversal).toBe(299.7);
    expect(r.commissionGiveback).toBe(33.3);
  });

  it("clamps fraction at 1 and handles zero gross", () => {
    expect(refundReversal(1000, 900, 100, 5000).fraction).toBe(1);
    expect(refundReversal(0, 0, 0, 100).fraction).toBe(1);
  });
});
