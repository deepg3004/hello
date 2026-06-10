import { describe, expect, it } from "vitest";

import {
  signBuyerSession,
  verifyBuyerSession,
  signBuyerOAuthState,
  verifyBuyerOAuthState,
  signBuyerHandoff,
  verifyBuyerHandoff,
} from "@/lib/buyer-portal";

describe("buyer session token", () => {
  it("round-trips the email", () => {
    const t = signBuyerSession("buyer@example.com");
    expect(verifyBuyerSession(t)).toBe("buyer@example.com");
  });

  it("rejects a tampered token", () => {
    const t = signBuyerSession("buyer@example.com");
    expect(verifyBuyerSession(t + "x")).toBeNull();
    expect(verifyBuyerSession("garbage")).toBeNull();
  });
});

describe("oauth state", () => {
  it("round-trips the origin host", () => {
    const s = signBuyerOAuthState("rahul.invoxai.io");
    expect(verifyBuyerOAuthState(s)).toEqual({ host: "rahul.invoxai.io" });
  });
});

describe("handoff token", () => {
  it("round-trips the email", () => {
    const h = signBuyerHandoff("buyer@example.com");
    expect(verifyBuyerHandoff(h)).toBe("buyer@example.com");
  });
});

describe("cross-type rejection (token confusion)", () => {
  it("a handoff token is NOT a valid session", () => {
    const h = signBuyerHandoff("buyer@example.com");
    expect(verifyBuyerSession(h)).toBeNull();
  });

  it("an oauth-state token is NOT a valid session", () => {
    const s = signBuyerOAuthState("rahul.invoxai.io");
    expect(verifyBuyerSession(s)).toBeNull();
  });

  it("a session token is NOT a valid handoff or state", () => {
    const t = signBuyerSession("buyer@example.com");
    expect(verifyBuyerHandoff(t)).toBeNull();
    expect(verifyBuyerOAuthState(t)).toBeNull();
  });

  it("a handoff token is NOT a valid oauth state (and vice-versa)", () => {
    const h = signBuyerHandoff("buyer@example.com");
    const s = signBuyerOAuthState("rahul.invoxai.io");
    expect(verifyBuyerOAuthState(h)).toBeNull();
    expect(verifyBuyerHandoff(s)).toBeNull();
  });
});
