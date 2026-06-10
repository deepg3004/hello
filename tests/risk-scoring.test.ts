import { describe, expect, it } from "vitest";

import {
  DEFAULT_THRESHOLDS,
  scoreOrderRisk,
  type RiskSignals,
} from "@/lib/risk/evaluate";

const base: RiskSignals = {
  emailOrdersLastHour: 0,
  ipOrdersLastHour: 0,
  duplicateRecently: false,
  amountInr: 100,
};

describe("scoreOrderRisk", () => {
  it("clean order scores 0 and is not flagged", () => {
    const v = scoreOrderRisk(base, DEFAULT_THRESHOLDS);
    expect(v.score).toBe(0);
    expect(v.flagged).toBe(false);
    expect(v.flags).toHaveLength(0);
  });

  it("a duplicate alone (weight 2) crosses the default threshold", () => {
    const v = scoreOrderRisk({ ...base, duplicateRecently: true }, DEFAULT_THRESHOLDS);
    expect(v.score).toBe(2);
    expect(v.flagged).toBe(true);
    expect(v.flags.map((f) => f.code)).toContain("duplicate");
  });

  it("high-value alone (weight 1) does not flag at threshold 2", () => {
    const v = scoreOrderRisk(
      { ...base, amountInr: 50000 },
      DEFAULT_THRESHOLDS,
    );
    expect(v.score).toBe(1);
    expect(v.flagged).toBe(false);
  });

  it("email velocity must EXCEED the threshold, not just equal it", () => {
    const atLimit = scoreOrderRisk(
      { ...base, emailOrdersLastHour: DEFAULT_THRESHOLDS.velocityEmailPerHour },
      DEFAULT_THRESHOLDS,
    );
    expect(atLimit.flags.some((f) => f.code === "velocity_email")).toBe(false);

    const over = scoreOrderRisk(
      { ...base, emailOrdersLastHour: DEFAULT_THRESHOLDS.velocityEmailPerHour + 1 },
      DEFAULT_THRESHOLDS,
    );
    expect(over.flags.some((f) => f.code === "velocity_email")).toBe(true);
  });

  it("combined signals sum weights (ip velocity + high value = 2 → flagged)", () => {
    const v = scoreOrderRisk(
      {
        emailOrdersLastHour: 0,
        ipOrdersLastHour: DEFAULT_THRESHOLDS.velocityIpPerHour + 1,
        duplicateRecently: false,
        amountInr: DEFAULT_THRESHOLDS.highValueInr,
      },
      DEFAULT_THRESHOLDS,
    );
    expect(v.score).toBe(2);
    expect(v.flagged).toBe(true);
    expect(v.flags.map((f) => f.code).sort()).toEqual(["high_value", "velocity_ip"]);
  });

  it("respects a custom flag threshold", () => {
    const strict = { ...DEFAULT_THRESHOLDS, flagThreshold: 1 };
    const v = scoreOrderRisk({ ...base, amountInr: 99999 }, strict);
    expect(v.score).toBe(1);
    expect(v.flagged).toBe(true);
  });
});
