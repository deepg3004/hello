import { describe, expect, it } from "vitest";

import { computeDiscount } from "@/lib/pricing";

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
