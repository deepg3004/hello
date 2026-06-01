import { describe, expect, it } from "vitest";

import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("quotes every field and joins with CRLF", () => {
    const out = toCsv(["A", "B"], [["1", "2"]]);
    expect(out).toBe('"A","B"\r\n"1","2"');
  });

  it("escapes embedded quotes by doubling them", () => {
    const out = toCsv(["name"], [['He said "hi"']]);
    expect(out).toBe('"name"\r\n"He said ""hi"""');
  });

  it("keeps commas and newlines inside fields intact", () => {
    const out = toCsv(["addr"], [["Line1, Line2\nLine3"]]);
    expect(out).toBe('"addr"\r\n"Line1, Line2\nLine3"');
  });

  it("renders null/undefined as empty strings", () => {
    const out = toCsv(["a", "b", "c"], [[null, undefined, 0]]);
    expect(out).toBe('"a","b","c"\r\n"","","0"');
  });
});
