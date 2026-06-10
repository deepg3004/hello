// =============================================================================
// AI website generation via Claude (Anthropic). Server-only. Turns a seller's
// short business brief into a structured page (AiSite), which lib/builder/ai-map
// then sanitises into a real BuilderDocument. Uses structured outputs so the
// model is constrained to our JSON schema — no parsing guesswork, no markup.
// =============================================================================

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { type AiSite } from "@/lib/builder/ai-map";
import { getAnthropicCredential } from "@/lib/integration-settings";

const MODEL = "claude-opus-4-8";

export interface SiteBrief {
  businessType: string;
  businessName: string;
  goal?: string;
  audience?: string;
  style?: string;
  colors?: string;
}

export interface GenerateResult {
  ok: boolean;
  site?: AiSite;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** True when the AI generator has a usable credential (admin-saved or env). */
export async function aiGeneratorEnabled(): Promise<boolean> {
  const cred = await getAnthropicCredential();
  return !!(cred.apiKey || cred.authToken);
}

const SYSTEM = `You are a senior conversion copywriter and web designer for InvoxAI, a creator-commerce platform. Given a short brief, design a single premium, modern, mobile-first landing page.

Rules:
- Return ONLY the structured JSON for the page — no commentary.
- Build the page as an ordered list of sections; each section is one full-width band of widgets.
- Open with a hero: a punchy h1 heading, a one-line value-proposition text, and a primary call-to-action button. Use the buyer's likely intent for the button label (e.g. "Start now", "Book a call", "Buy now").
- Then include the sections that fit the business: features (use heading + text, or icon + heading + text), social proof (testimonials), pricing (1-3 pricing widgets), and a closing call-to-action.
- Write specific, benefit-led copy in the business's voice — never lorem ipsum, never placeholder brackets.
- Use spacers/dividers sparingly for rhythm. Keep headings concise.
- Do NOT invent image or video URLs — omit image/video widgets unless a real URL is provided in the brief. Icons (lucide names like "Zap", "ShieldCheck", "Rocket", "Star", "Check") are fine.
- Pick a tasteful theme: a primary hex colour, an accent hex, and a light background. Apply the primary colour to buttons.
- Aim for 5-8 sections. Make it feel finished and trustworthy.

OUTPUT FORMAT — return ONLY a single JSON object (no markdown fences, no commentary), exactly this shape:
{
  "title": "Page title",
  "seoTitle": "<=60 char SEO title",
  "seoDescription": "<=155 char meta description",
  "theme": { "primary": "#4f46e5", "accent": "#06b6d4", "background": "#ffffff" },
  "sections": [ { "widgets": [ WIDGET, WIDGET ] } ]
}
Each WIDGET is ONE of these objects (set "type" plus only that type's fields):
- {"type":"heading","text":"...","level":"h1|h2|h3","align":"left|center|right"}
- {"type":"text","text":"...","align":"left|center|right"}
- {"type":"button","label":"...","url":"#","variant":"filled|outline","color":"#4f46e5","align":"center"}
- {"type":"icon","name":"<lucide icon e.g. Zap, ShieldCheck, Rocket, Star>","color":"#4f46e5","size":40,"align":"center"}
- {"type":"testimonial","quote":"...","author":"...","role":"..."}
- {"type":"pricing","name":"Pro","price":"₹1,499","period":"/mo","features":["Feature one","Feature two"],"label":"Get started","url":"#","color":"#4f46e5"}
- {"type":"divider"}
- {"type":"spacer","height":40}
- {"type":"image","src":"https://REAL-URL","alt":"..."}   (only if a real image URL is given)
- {"type":"video","url":"https://youtube.com/..."}        (only if a real video URL is given)
- {"type":"features","color":"#4f46e5","items":[{"icon":"Zap","title":"...","text":"..."},{"icon":"ShieldCheck","title":"...","text":"..."}]}
- {"type":"stats","color":"#4f46e5","items":[{"value":"10k+","label":"Customers"},{"value":"4.9★","label":"Rating"}]}
- {"type":"faq","items":[{"q":"...","a":"..."},{"q":"...","a":"..."}]}
- {"type":"badges","items":[{"text":"Secure checkout"},{"text":"30-day guarantee"}]}
- {"type":"cta_banner","heading":"...","text":"...","label":"Get started","url":"#","color":"#4f46e5"}

Prefer the rich widgets where they fit: a "features" grid for benefits, a "stats" row for social proof, a "faq" near the end, "badges" under the hero or pricing, and a "cta_banner" as the closing call-to-action. Output valid JSON only — start with { and end with }.`;

function buildUserPrompt(b: SiteBrief): string {
  const lines = [
    `Business type: ${b.businessType}`,
    `Business name: ${b.businessName}`,
  ];
  if (b.goal) lines.push(`Primary goal: ${b.goal}`);
  if (b.audience) lines.push(`Target audience: ${b.audience}`);
  if (b.style) lines.push(`Preferred style/tone: ${b.style}`);
  if (b.colors) lines.push(`Colour preference: ${b.colors}`);
  return `Design the landing page for this business.\n\n${lines.join("\n")}`;
}

export async function generateSite(brief: SiteBrief): Promise<GenerateResult> {
  const cred = await getAnthropicCredential();
  if (!cred.apiKey && !cred.authToken) {
    return { ok: false, error: "AI generation isn't configured." };
  }
  // Prefer an API key; fall back to an account auth token (sk-ant-oat…).
  const client = cred.apiKey
    ? new Anthropic({ apiKey: cred.apiKey })
    : new Anthropic({ authToken: cred.authToken! });
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: buildUserPrompt(brief) }],
    } as Anthropic.MessageCreateParamsNonStreaming);

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "The request was declined. Try a different brief." };
    }

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text : "";
    if (!text) return { ok: false, error: "No content was generated." };

    // Robustly extract the JSON object — tolerate ``` fences or stray prose.
    let raw = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const a = raw.indexOf("{");
    const b = raw.lastIndexOf("}");
    if (a >= 0 && b > a) raw = raw.slice(a, b + 1);

    let site: AiSite;
    try {
      site = JSON.parse(raw) as AiSite;
    } catch {
      return { ok: false, error: "The generated layout was malformed." };
    }

    return {
      ok: true,
      site,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    };
  } catch (e) {
    console.error("[ai-generate] failed", e);
    const msg = e instanceof Anthropic.APIError ? `AI error (${e.status})` : "AI generation failed.";
    return { ok: false, error: msg };
  }
}
