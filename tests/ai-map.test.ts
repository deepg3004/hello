import { describe, expect, it } from "vitest";

import { documentFromAiSite, type AiSite } from "@/lib/builder/ai-map";

describe("documentFromAiSite", () => {
  it("maps a normal AI site into a builder document", () => {
    const ai: AiSite = {
      title: "PeakForm",
      sections: [
        {
          widgets: [
            { type: "heading", text: "Get fit", level: "h1" },
            { type: "text", text: "Coaching that works." },
            { type: "button", label: "Start", url: "https://x.com" },
          ],
        },
      ],
    };
    const doc = documentFromAiSite(ai);
    expect(doc.sections).toHaveLength(1);
    const widgets = doc.sections[0].columns[0].widgets;
    expect(widgets.map((w) => w.type)).toEqual(["heading", "text", "button"]);
    expect(widgets[0].content.level).toBe("h1");
    // every node gets an id
    expect(widgets.every((w) => typeof w.id === "string" && w.id.length > 0)).toBe(true);
  });

  it("drops unknown widget types", () => {
    const ai = {
      title: "X",
      sections: [{ widgets: [{ type: "script" }, { type: "heading", text: "Hi" }] }],
    } as unknown as AiSite;
    const widgets = documentFromAiSite(ai).sections[0].columns[0].widgets;
    expect(widgets.map((w) => w.type)).toEqual(["heading"]);
  });

  it("rejects non-http(s) urls (no javascript:/data:)", () => {
    const ai: AiSite = {
      title: "X",
      sections: [
        {
          widgets: [
            { type: "button", label: "Go", url: "javascript:alert(1)" },
            { type: "image", src: "data:text/html,<script>" },
          ],
        },
      ],
    };
    const widgets = documentFromAiSite(ai).sections[0].columns[0].widgets;
    // image with an unsafe src is dropped entirely
    expect(widgets.map((w) => w.type)).toEqual(["button"]);
    // button keeps a safe fallback href, never the javascript: url
    expect(widgets[0].content.url).toBe("#");
  });

  it("coerces an invalid hex colour to the default", () => {
    const ai: AiSite = {
      title: "X",
      sections: [{ widgets: [{ type: "button", label: "Go", color: "red; }" }] }],
    };
    const w = documentFromAiSite(ai).sections[0].columns[0].widgets[0];
    expect(w.content.color).toBe("#4f46e5");
  });

  it("joins pricing features into newline text", () => {
    const ai: AiSite = {
      title: "X",
      sections: [{ widgets: [{ type: "pricing", name: "Pro", features: ["A", "B"] }] }],
    };
    const w = documentFromAiSite(ai).sections[0].columns[0].widgets[0];
    expect(w.content.features).toBe("A\nB");
  });

  it("degrades an empty/garbage payload to a valid empty document", () => {
    const doc = documentFromAiSite({ title: "X", sections: [] });
    expect(Array.isArray(doc.sections)).toBe(true);
    expect(doc.sections.length).toBeGreaterThan(0); // emptyDocument() has one section
  });

  it("drops sections whose widgets all fail validation", () => {
    const ai = {
      title: "X",
      sections: [{ widgets: [{ type: "heading" }] }], // heading with no text → dropped
    } as unknown as AiSite;
    const doc = documentFromAiSite(ai);
    // section had no valid widgets → whole doc degrades to emptyDocument
    expect(doc.sections[0].columns[0].widgets).toHaveLength(0);
  });

  it("maps the rich widgets (faq, features, stats, badges, cta_banner)", () => {
    const ai = {
      title: "Rich",
      sections: [
        {
          widgets: [
            { type: "features", color: "#111111", items: [{ icon: "Zap", title: "Fast", text: "Quick" }] },
            { type: "stats", items: [{ value: "10k+", label: "Users" }] },
            { type: "faq", items: [{ q: "How?", a: "Easy." }] },
            { type: "badges", items: [{ text: "Secure" }] },
            { type: "cta_banner", heading: "Start now", label: "Go", url: "https://x.com" },
          ],
        },
      ],
    } as unknown as AiSite;
    const w = documentFromAiSite(ai).sections[0].columns[0].widgets;
    expect(w.map((x) => x.type)).toEqual(["features", "stats", "faq", "badges", "cta_banner"]);
    expect((w[0].content.items as unknown[]).length).toBe(1);
    expect(w[0].content.color).toBe("#111111");
    expect(w[2].content.items).toEqual([{ q: "How?", a: "Easy." }]);
    expect(w[4].content.heading).toBe("Start now");
    expect(w[4].content.url).toBe("https://x.com");
  });

  it("drops list widgets with no usable rows", () => {
    const ai = {
      title: "X",
      sections: [{ widgets: [{ type: "faq", items: [] }, { type: "stats", items: [{ label: "no value" }] }, { type: "heading", text: "ok" }] }],
    } as unknown as AiSite;
    const w = documentFromAiSite(ai).sections[0].columns[0].widgets;
    expect(w.map((x) => x.type)).toEqual(["heading"]); // empty faq + value-less stats dropped
  });
});
