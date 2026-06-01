import { describe, expect, it } from "vitest";

import { isValidEmail, isValidGstin, isValidPhone } from "@/lib/validators";

describe("isValidGstin", () => {
  it("accepts a well-formed GSTIN", () => {
    expect(isValidGstin("22AAAAA0000A1Z5")).toBe(true);
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
  });
  it("lowercases are normalised before checking", () => {
    expect(isValidGstin("22aaaaa0000a1z5")).toBe(true);
  });
  it("rejects wrong length / shape", () => {
    expect(isValidGstin("22AAAAA0000A1Z")).toBe(false); // 14 chars
    expect(isValidGstin("ABCDE1234567890")).toBe(false);
    expect(isValidGstin("")).toBe(false);
  });
});

describe("isValidPhone", () => {
  it("accepts common formats", () => {
    expect(isValidPhone("+91 98765 43210")).toBe(true);
    expect(isValidPhone("9876543210")).toBe(true);
    expect(isValidPhone("(044) 1234-5678")).toBe(true);
  });
  it("rejects too short / letters", () => {
    expect(isValidPhone("123")).toBe(false);
    expect(isValidPhone("call-me")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts valid, rejects invalid", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("no-at-sign")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
});
