import { describe, expect, it } from "vitest";

import { safeNext } from "@/lib/safe-redirect";

describe("safeNext", () => {
  it("allows ordinary in-app paths", () => {
    expect(safeNext("/dashboard/pages")).toBe("/dashboard/pages");
    expect(safeNext("/p/abc/checkout")).toBe("/p/abc/checkout");
  });

  it("blocks absolute / external URLs", () => {
    expect(safeNext("https://evil.example.com/phish")).toBe("/dashboard");
    expect(safeNext("http://evil.com")).toBe("/dashboard");
  });

  it("blocks protocol-relative and backslash tricks", () => {
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("/\\evil.com")).toBe("/dashboard");
    expect(safeNext("/foo\\bar")).toBe("/dashboard");
  });

  it("blocks auth bounce loops", () => {
    expect(safeNext("/login")).toBe("/dashboard");
    expect(safeNext("/login?next=/x")).toBe("/dashboard");
    expect(safeNext("/auth/callback")).toBe("/dashboard");
    expect(safeNext("/signup")).toBe("/dashboard");
  });

  it("rejects non-strings, empty, and over-long inputs", () => {
    expect(safeNext(undefined)).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext(123)).toBe("/dashboard");
    expect(safeNext("")).toBe("/dashboard");
    expect(safeNext("/" + "a".repeat(600))).toBe("/dashboard");
  });

  it("honours a custom fallback", () => {
    expect(safeNext("https://evil.com", "/home")).toBe("/home");
  });

  it("does not treat lookalike paths as auth paths", () => {
    // "/loginhelp" is not "/login" nor "/login/..."
    expect(safeNext("/loginhelp")).toBe("/loginhelp");
  });
});
