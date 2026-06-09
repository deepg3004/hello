// Ready-made premium templates for the builder, defined in CODE (no DB seed
// migration needed). The gallery lists these; "Apply in 1 click" copies a
// template's page document + header + footer + bottom-bar into the seller's
// site. Each is a complete page with the correct primary action for its type.

import type { BuilderDocument, SectionNode } from "@/lib/builder/types";

export interface BuilderTemplate {
  id: string;
  name: string;
  page_type: "payment" | "landing" | "leads";
  category: string;
  preview_image_url: string;
  background_style: string;
  document: BuilderDocument;
  header: BuilderDocument;
  footer: BuilderDocument;
  bottombar: {
    enabled: boolean;
    primaryLabel?: string;
    channels: { telegram?: boolean; whatsapp?: boolean; call?: boolean; instagram?: boolean };
  };
}

// ── tiny builders (module-level counter → stable unique ids at import) ─────────
let _n = 0;
const nid = (p: string) => `${p}_${++_n}`;
const w = (type: string, content: Record<string, unknown> = {}, style?: Record<string, unknown>) => ({
  id: nid("w"),
  type,
  content,
  ...(style ? { style } : {}),
});
const col = (...widgets: ReturnType<typeof w>[]) => ({ id: nid("c"), width: 100, widgets });
const sec = (...columns: ReturnType<typeof col>[]): SectionNode => ({ id: nid("s"), columns });
const doc = (...sections: SectionNode[]): BuilderDocument => ({ sections });
const PIMG = (seed: string, ar = "1200/700") => `https://picsum.photos/seed/lp-${seed}/${ar.replace("/", "/")}`;

// Shared header / footer used by the templates (sellers edit after applying).
const header = () =>
  doc(
    sec(
      col(
        w("image", { src: "", alt: "Logo", align: "left" }),
        w("menu", {
          align: "left",
          items: [
            { label: "Home", url: "#" },
            { label: "Features", url: "#" },
            { label: "Contact", url: "#" },
          ],
        }),
      ),
    ),
  );
const footer = () =>
  doc(
    sec(
      col(
        w("text", { text: "© Your brand. All rights reserved.", align: "center" }),
        w("social", {
          align: "center",
          items: [
            { icon: "Instagram", url: "#" },
            { icon: "Telegram", url: "#" },
            { icon: "Youtube", url: "#" },
          ],
        }),
      ),
    ),
  );

const bar = (
  primaryLabel: string,
  channels: BuilderTemplate["bottombar"]["channels"] = { whatsapp: true, telegram: true },
): BuilderTemplate["bottombar"] => ({ enabled: true, primaryLabel, channels });

export const BUILDER_TEMPLATES: BuilderTemplate[] = [
  // ── PAYMENT ────────────────────────────────────────────────────────────────
  {
    id: "pay-digital",
    name: "Digital Product",
    page_type: "payment",
    category: "Digital Products",
    preview_image_url: PIMG("paydigital"),
    background_style: "mesh",
    header: header(),
    footer: footer(),
    bottombar: bar("Buy Now", { whatsapp: true, telegram: true }),
    document: doc(
      sec(
        col(
          w("heading", { text: "The complete toolkit to level up", level: "h1", align: "center" }),
          w("text", { text: "Instant download. Lifetime access. 30-day money-back guarantee.", align: "center" }),
          w("buy", { name: "Pro Toolkit", price: "₹999", slug: "", label: "Buy now", color: "#16a34a" }, { desktop: { paddingY: 8 } }),
        ),
      ),
      sec(col(w("image", { src: PIMG("paydigital2"), align: "center" }))),
      sec(
        col(
          w("heading", { text: "What's inside", level: "h2", align: "center" }),
          w("pricing", { name: "Everything bundle", price: "₹999", period: "", features: "All templates\nVideo guides\nFuture updates\nPriority support", cta_label: "Get it now", cta_url: "#", color: "#16a34a" }),
        ),
      ),
      sec(col(w("testimonial", { quote: "Worth every rupee — saved me weeks.", author: "Verified buyer", role: "" }))),
    ),
  },
  {
    id: "pay-coaching",
    name: "Coaching Offer",
    page_type: "payment",
    category: "Coaching/Course",
    preview_image_url: PIMG("paycoach"),
    background_style: "gradient",
    header: header(),
    footer: footer(),
    bottombar: bar("Enroll Now", { whatsapp: true, call: true }),
    document: doc(
      sec(
        col(
          w("heading", { text: "1:1 Coaching that gets results", level: "h1", align: "center" }),
          w("text", { text: "A focused program to help you reach your goal faster.", align: "center" }),
          w("buy", { name: "Coaching Program", price: "₹4,999", slug: "", label: "Enroll now", color: "#4f46e5" }),
        ),
      ),
      sec(col(w("testimonial", { quote: "My business doubled in 3 months.", author: "Client", role: "Founder" }))),
      sec(col(w("pricing", { name: "8-week program", price: "₹4,999", period: "", features: "Weekly 1:1 calls\nAction plan\nChat support\nLifetime resources", cta_label: "Enroll", cta_url: "#", color: "#4f46e5" }))),
    ),
  },

  // ── LANDING ──────────────────────────────────────────────────────────────────
  {
    id: "land-business",
    name: "Business Landing",
    page_type: "landing",
    category: "Business",
    preview_image_url: PIMG("landbiz"),
    background_style: "mesh",
    header: header(),
    footer: footer(),
    bottombar: bar("Get Started", { whatsapp: true, call: true }),
    document: doc(
      sec(
        col(
          w("heading", { text: "Grow your business, the modern way", level: "h1", align: "center" }),
          w("text", { text: "Everything you need to launch, sell and scale — in one place.", align: "center" }),
          w("button", { label: "Get started", url: "#", align: "center", variant: "filled", color: "#4f46e5" }),
        ),
      ),
      sec(col(w("image", { src: PIMG("landbiz2"), align: "center" }))),
      sec(col(w("heading", { text: "Why teams choose us", level: "h2", align: "center" }))),
      sec(col(w("testimonial", { quote: "The only tool we couldn't live without.", author: "Operations lead", role: "" }))),
      sec(col(w("heading", { text: "Ready to grow?", level: "h2", align: "center" }), w("button", { label: "Start free", url: "#", align: "center", color: "#4f46e5" }))),
    ),
  },
  {
    id: "land-creator",
    name: "Creator Landing",
    page_type: "landing",
    category: "Creator/Influencer",
    preview_image_url: PIMG("landcreator"),
    background_style: "particles",
    header: header(),
    footer: footer(),
    bottombar: bar("Join Now", { instagram: true, telegram: true, whatsapp: true }),
    document: doc(
      sec(
        col(
          w("heading", { text: "Join my community", level: "h1", align: "center" }),
          w("text", { text: "Exclusive content, live sessions and a community that grows with you.", align: "center" }),
          w("button", { label: "Join now", url: "#", align: "center", color: "#ec4899" }),
          w("social", { align: "center", items: [{ icon: "Instagram", url: "#" }, { icon: "Youtube", url: "#" }, { icon: "Telegram", url: "#" }] }),
        ),
      ),
      sec(col(w("image", { src: PIMG("landcreator2"), align: "center" }))),
      sec(col(w("testimonial", { quote: "Best community I've ever joined.", author: "Member", role: "" }))),
    ),
  },

  // ── LEADS ─────────────────────────────────────────────────────────────────────
  {
    id: "lead-services",
    name: "Service Quote",
    page_type: "leads",
    category: "Services",
    preview_image_url: PIMG("leadservice"),
    background_style: "gradient",
    header: header(),
    footer: footer(),
    bottombar: bar("Get a Quote", { whatsapp: true, call: true }),
    document: doc(
      sec(
        col(
          w("heading", { text: "Get a free quote in minutes", level: "h1", align: "center" }),
          w("text", { text: "Tell us what you need and we'll get back within 24 hours.", align: "center" }),
        ),
      ),
      sec(col(w("form", { title: "Request a quote", button: "Get my quote", fields: "full" }))),
      sec(col(w("testimonial", { quote: "Fast, professional and great value.", author: "Customer", role: "" }))),
    ),
  },
  {
    id: "lead-event",
    name: "Event Registration",
    page_type: "leads",
    category: "Events",
    preview_image_url: PIMG("leadevent"),
    background_style: "mesh",
    header: header(),
    footer: footer(),
    bottombar: bar("Register", { whatsapp: true, telegram: true }),
    document: doc(
      sec(
        col(
          w("heading", { text: "Reserve your seat", level: "h1", align: "center" }),
          w("text", { text: "A free live session — limited seats. Register below.", align: "center" }),
        ),
      ),
      sec(col(w("form", { title: "Save my seat", button: "Register free", fields: "name_email_phone" }))),
    ),
  },

  {
    id: "pay-shop",
    name: "Online Shop Product",
    page_type: "payment",
    category: "Online Shop",
    preview_image_url: PIMG("payshop"),
    background_style: "solid",
    header: header(),
    footer: footer(),
    bottombar: bar("Buy Now", { whatsapp: true, call: true }),
    document: doc(
      sec(col(w("image", { src: PIMG("payshop2"), align: "center" }))),
      sec(
        col(
          w("heading", { text: "Premium product, fair price", level: "h1", align: "center" }),
          w("text", { text: "Free shipping. Easy returns. Loved by thousands.", align: "center" }),
          w("buy", { name: "The product", price: "₹1,299", slug: "", label: "Buy now", color: "#16a34a" }),
        ),
      ),
      sec(col(w("testimonial", { quote: "Quality exceeded my expectations.", author: "Verified buyer", role: "" }))),
    ),
  },
  {
    id: "land-restaurant",
    name: "Restaurant",
    page_type: "landing",
    category: "Restaurant",
    preview_image_url: PIMG("landrest"),
    background_style: "gradient",
    header: header(),
    footer: footer(),
    bottombar: bar("Reserve a Table", { whatsapp: true, call: true }),
    document: doc(
      sec(
        col(
          w("heading", { text: "Taste something unforgettable", level: "h1", align: "center" }),
          w("text", { text: "Fresh ingredients, bold flavours, warm hospitality.", align: "center" }),
          w("button", { label: "Reserve a table", url: "#", align: "center", color: "#b45309" }),
        ),
      ),
      sec(col(w("image", { src: PIMG("landrest2"), align: "center" }))),
      sec(col(w("testimonial", { quote: "Best meal we've had all year.", author: "Diner", role: "" }))),
    ),
  },
  {
    id: "land-portfolio",
    name: "Portfolio",
    page_type: "landing",
    category: "Portfolio",
    preview_image_url: PIMG("landport"),
    background_style: "particles",
    header: header(),
    footer: footer(),
    bottombar: bar("Hire Me", { whatsapp: true, instagram: true }),
    document: doc(
      sec(
        col(
          w("heading", { text: "Selected work", level: "h1", align: "center" }),
          w("text", { text: "Design, build, ship — a look at what I create.", align: "center" }),
        ),
      ),
      sec(col(w("image", { src: PIMG("landport2"), align: "center" }))),
      sec(col(w("button", { label: "Hire me", url: "#", align: "center", color: "#4f46e5" }))),
    ),
  },
  {
    id: "lead-business",
    name: "Business Enquiry",
    page_type: "leads",
    category: "Business",
    preview_image_url: PIMG("leadbiz"),
    background_style: "mesh",
    header: header(),
    footer: footer(),
    bottombar: bar("Contact Us", { whatsapp: true, call: true }),
    document: doc(
      sec(
        col(
          w("heading", { text: "Let's work together", level: "h1", align: "center" }),
          w("text", { text: "Tell us about your project and we'll be in touch.", align: "center" }),
        ),
      ),
      sec(col(w("form", { title: "Contact us", button: "Send enquiry", fields: "full" }))),
    ),
  },
];

export function templateById(id: string): BuilderTemplate | undefined {
  return BUILDER_TEMPLATES.find((t) => t.id === id);
}

/** Categories present, grouped by page type — for the gallery filters. */
export const TEMPLATE_PAGE_TYPES: Array<{ key: BuilderTemplate["page_type"]; label: string }> = [
  { key: "payment", label: "Payment" },
  { key: "landing", label: "Landing" },
  { key: "leads", label: "Leads" },
];
