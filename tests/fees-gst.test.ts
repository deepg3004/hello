import { describe, expect, it } from "vitest";

import {
  DEFAULT_GST_PERCENT,
  gstOnFeePaise,
  grossFeePaise,
  gstPercentFromConfig,
  resolvePlatformFeePaise,
  type FeeConfig,
} from "@/lib/fees";

describe("gstOnFeePaise", () => {
  it("charges GST on the platform fee", () => {
    // ₹30 fee (3000 paise) + 18% GST = ₹5.40 (540 paise)
    expect(gstOnFeePaise(3000, 18)).toBe(540);
  });

  it("rounds to the nearest paise", () => {
    // 18% of 2999 paise = 539.82 -> 540
    expect(gstOnFeePaise(2999, 18)).toBe(540);
  });

  it("is zero when GST percent is zero or negative", () => {
    expect(gstOnFeePaise(3000, 0)).toBe(0);
    expect(gstOnFeePaise(3000, -5)).toBe(0);
  });

  it("never returns a negative amount", () => {
    expect(gstOnFeePaise(-1000, 18)).toBe(0);
  });
});

describe("grossFeePaise", () => {
  it("returns fee + GST as the wallet debit", () => {
    // The worked example from the spec: ₹1,000 order, 3% fee.
    const fee = 3000; // ₹30
    expect(grossFeePaise(fee, 18)).toBe(3540); // ₹35.40
  });

  it("equals the fee when GST is off", () => {
    expect(grossFeePaise(3000, 0)).toBe(3000);
  });
});

describe("gstPercentFromConfig", () => {
  const base: Omit<FeeConfig, "gstPercent"> = {
    default: { fixed_paise: 0, percent: 0 },
    byPlan: {},
    categories: [],
  };

  it("uses the configured percent", () => {
    expect(gstPercentFromConfig({ ...base, gstPercent: 12 })).toBe(12);
  });

  it("falls back to the default for null config", () => {
    expect(gstPercentFromConfig(null)).toBe(DEFAULT_GST_PERCENT);
  });

  it("allows an explicit zero (GST disabled)", () => {
    expect(gstPercentFromConfig({ ...base, gstPercent: 0 })).toBe(0);
  });
});

describe("fee resolution + GST end to end", () => {
  const cfg: FeeConfig = {
    default: { fixed_paise: 0, percent: 3 }, // 3% default fee
    byPlan: {},
    categories: [],
    gstPercent: 18,
  };

  it("resolves a 3% fee and adds 18% GST on a ₹1,000 order", () => {
    const fee = resolvePlatformFeePaise(
      { plan: "free", feeCategory: null, orderAmountPaise: 100_000 },
      cfg,
    );
    expect(fee).toBe(3000); // ₹30
    const gross = grossFeePaise(fee!, gstPercentFromConfig(cfg));
    expect(gross).toBe(3540); // ₹35.40 debited from wallet
  });
});
