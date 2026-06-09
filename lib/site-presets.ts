// Ready-made homepage layouts (block presets) for the website builder. Pure
// data — importable by client + server. A seller can one-click create a Home
// page pre-filled for their niche, then edit it.

export interface SiteBlock {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface SitePreset {
  key: string;
  label: string;
  description: string;
  blocks: SiteBlock[];
}

interface Copy {
  label: string;
  headline: string;
  subheadline: string;
  productsTitle: string;
  aboutBody: string;
}

// Stable, free demo images (seed-stable → same image every render). Sellers
// replace these from the editor; they ship so templates look complete on day 1.
const PIMG = (seed: string, w = 1280, h = 860) =>
  `https://picsum.photos/seed/invox-${seed}/${w}/${h}`;

// A reusable demo gallery (used by the Showcase template).
const DEMO_GALLERY = [
  { image: PIMG("gal1", 800, 800), caption: "Project one" },
  { image: PIMG("gal2", 800, 800), caption: "Project two" },
  { image: PIMG("gal3", 800, 800), caption: "Project three" },
  { image: PIMG("gal4", 800, 800), caption: "Project four" },
  { image: PIMG("gal5", 800, 800), caption: "Project five" },
  { image: PIMG("gal6", 800, 800), caption: "Project six" },
];

// Niche-flavoured copy. Categories not listed use the generic starter.
const CATEGORY_COPY: Record<string, Copy> = {
  finance: {
    label: "Finance creator",
    headline: "Master your money & the markets",
    subheadline: "Trading, investing and personal-finance guidance that actually works.",
    productsTitle: "Courses & signals",
    aboutBody: "Share your track record, credentials and the results your students get.",
  },
  coaching: {
    label: "Coach",
    headline: "Coaching that gets real results",
    subheadline: "1:1 and group programs to help you reach your goals faster.",
    productsTitle: "Programs & sessions",
    aboutBody: "Tell people about your method, experience and the transformation you deliver.",
  },
  astrology: {
    label: "Astrologer",
    headline: "Guidance written in the stars",
    subheadline: "Personalised readings, reports and remedies tailored to you.",
    productsTitle: "Readings & reports",
    aboutBody: "Share your background, specialities and what a session with you is like.",
  },
  fitness: {
    label: "Fitness coach",
    headline: "Get fit. Stay strong.",
    subheadline: "Training and nutrition plans built for real, lasting results.",
    productsTitle: "Plans & coaching",
    aboutBody: "Share your story, certifications and client transformations.",
  },
  education: {
    label: "Educator",
    headline: "Learn a skill that pays",
    subheadline: "Practical courses you can actually finish and apply.",
    productsTitle: "Courses",
    aboutBody: "Tell students who you are and why you're the right person to learn from.",
  },
  digital_marketing: {
    label: "Marketer",
    headline: "Grow your brand online",
    subheadline: "Proven playbooks, templates and coaching to scale your reach.",
    productsTitle: "Courses & toolkits",
    aboutBody: "Share your results, clients and the strategies you teach.",
  },
  design: {
    label: "Designer",
    headline: "Design that moves people",
    subheadline: "Services, templates and resources for standout brands.",
    productsTitle: "Services & products",
    aboutBody: "Show your style, clients and what it's like to work with you.",
  },
};

function starterBlocks(copy: Copy): SiteBlock[] {
  return [
    {
      id: "hero",
      type: "hero",
      data: {
        eyebrow: "Welcome",
        headline: copy.headline,
        subheadline: copy.subheadline,
        cta_label: "Get started",
        image: PIMG("starter-hero"),
      },
    },
    {
      id: "stats",
      type: "stats",
      data: {
        _bg: "subtle",
        items: [
          { value: "500+", label: "Happy clients" },
          { value: "4.9★", label: "Average rating" },
          { value: "5+ yrs", label: "Experience" },
        ],
      },
    },
    {
      id: "about",
      type: "about",
      data: { heading: "About me", body: copy.aboutBody, image: PIMG("starter-about", 900, 900) },
    },
    {
      id: "features",
      type: "features",
      data: {
        title: "Why work with me",
        items: [
          { title: "Proven results", text: "A track record you can trust." },
          { title: "Personal support", text: "I'm with you at every step." },
          { title: "Real value", text: "Practical, no-fluff outcomes." },
        ],
      },
    },
    {
      id: "products",
      type: "products",
      data: { _bg: "subtle", title: copy.productsTitle },
    },
    {
      id: "pricing",
      type: "pricing",
      data: {
        title: "Simple pricing",
        items: [
          { name: "Starter", price: "₹499", period: "", features: "Core access\nEmail support", cta_label: "Get Starter", url: "", highlighted: false },
          { name: "Pro", price: "₹1,499", period: "", features: "Everything in Starter\nPriority support\nBonus material", cta_label: "Get Pro", url: "", highlighted: true },
        ],
      },
    },
    {
      id: "testimonials",
      type: "testimonials",
      data: {
        title: "What people say",
        items: [
          { quote: "Exactly what I needed — highly recommend.", author: "A happy client", role: "" },
        ],
      },
    },
    {
      id: "faq",
      type: "faq",
      data: {
        title: "Questions & answers",
        items: [
          { q: "How do I get started?", a: "Pick an option above and check out — you get instant access." },
          { q: "Can I get a refund?", a: "See our refund policy linked in the footer." },
        ],
      },
    },
    {
      id: "cta",
      type: "cta",
      data: {
        title: "Ready to begin?",
        subtitle: "Drop your email and I'll be in touch.",
        cta_label: "Count me in",
      },
    },
    { id: "social", type: "social", data: { title: "Follow me" } },
  ];
}

/** A fuller, "showcase" homepage with section-background rhythm + contact. */
function premiumBlocks(copy: Copy): SiteBlock[] {
  return [
    {
      id: "hero",
      type: "hero",
      data: {
        eyebrow: copy.label,
        headline: copy.headline,
        subheadline: copy.subheadline,
        cta_label: "Get started",
        image: PIMG("premium-hero"),
      },
    },
    {
      id: "logos",
      type: "logos",
      data: { _bg: "subtle", title: "Trusted by", items: [] },
    },
    {
      id: "stats",
      type: "stats",
      data: {
        items: [
          { value: "10k+", label: "People helped" },
          { value: "4.9★", label: "Average rating" },
          { value: "7+ yrs", label: "Experience" },
        ],
      },
    },
    {
      id: "about",
      type: "about",
      data: { _bg: "subtle", heading: "About me", body: copy.aboutBody, image: PIMG("premium-about", 900, 900) },
    },
    {
      id: "features",
      type: "features",
      data: {
        title: "Why work with me",
        items: [
          { title: "Proven results", text: "A track record you can trust." },
          { title: "Personal support", text: "I'm with you at every step." },
          { title: "Real value", text: "Practical, no-fluff outcomes." },
        ],
      },
    },
    {
      id: "products",
      type: "products",
      data: { _bg: "subtle", title: copy.productsTitle },
    },
    {
      id: "pricing",
      type: "pricing",
      data: {
        title: "Choose your plan",
        items: [
          { name: "Starter", price: "₹499", period: "", features: "Core access\nEmail support", cta_label: "Get Starter", url: "", highlighted: false },
          { name: "Pro", price: "₹1,499", period: "", features: "Everything in Starter\nPriority support\nBonus material", cta_label: "Get Pro", url: "", highlighted: true },
          { name: "VIP", price: "₹4,999", period: "", features: "Everything in Pro\n1:1 sessions\nLifetime access", cta_label: "Go VIP", url: "", highlighted: false },
        ],
      },
    },
    {
      id: "testimonials",
      type: "testimonials",
      data: {
        _bg: "subtle",
        title: "What people say",
        items: [
          { quote: "Exactly what I needed — highly recommend.", author: "A happy client", role: "" },
          { quote: "Clear, practical and genuinely valuable.", author: "Verified buyer", role: "" },
        ],
      },
    },
    {
      id: "faq",
      type: "faq",
      data: {
        title: "Questions & answers",
        items: [
          { q: "How do I get started?", a: "Pick a plan above and check out — you get instant access." },
          { q: "Do you offer support?", a: "Yes — reach out any time via the contact form below." },
          { q: "Can I get a refund?", a: "See our refund policy linked in the footer." },
        ],
      },
    },
    {
      id: "cta",
      type: "cta",
      data: { _bg: "accent", title: "Ready to begin?", subtitle: "Join now and get started today.", cta_label: "Count me in" },
    },
    {
      id: "contact",
      type: "contact",
      data: { title: "Get in touch", subtitle: "Questions? Send me a message.", cta_label: "Send message" },
    },
    { id: "social", type: "social", data: { _bg: "subtle", title: "Follow me" } },
  ];
}

const GENERIC: Copy = {
  label: "Starter",
  headline: "Hi — here's how I can help you",
  subheadline: "A short line about what you do and who you help.",
  productsTitle: "What I offer",
  aboutBody: "Share your story, experience and what makes your work valuable.",
};

// ── Structure-distinct templates (available to every niche) ─────────────────

/** Link-in-bio: ultra-short — hero, your products as link cards, socials. */
function linkInBioBlocks(copy: Copy): SiteBlock[] {
  return [
    {
      id: "hero",
      type: "hero",
      data: {
        eyebrow: "",
        headline: copy.label,
        subheadline: copy.subheadline,
        cta_label: "See what I offer",
        image: PIMG("bio-hero", 900, 900),
      },
    },
    { id: "products", type: "products", data: { title: copy.productsTitle } },
    {
      id: "cta",
      type: "cta",
      data: {
        _bg: "subtle",
        title: "Work with me",
        subtitle: "Drop your email and I'll be in touch.",
        cta_label: "Get in touch",
      },
    },
    { id: "social", type: "social", data: { title: "Find me online" } },
  ];
}

/** Storefront: commerce-forward — products + pricing + proof + FAQ + CTA. */
function storefrontBlocks(copy: Copy): SiteBlock[] {
  return [
    {
      id: "hero",
      type: "hero",
      data: { eyebrow: "Shop", headline: copy.headline, subheadline: copy.subheadline, cta_label: "Browse", image: PIMG("store-hero") },
    },
    { id: "products", type: "products", data: { _bg: "subtle", title: copy.productsTitle } },
    {
      id: "pricing",
      type: "pricing",
      data: {
        title: "Pick your plan",
        items: [
          { name: "Starter", price: "₹499", period: "", features: "Core access\nEmail support", cta_label: "Get Starter", url: "", highlighted: false },
          { name: "Pro", price: "₹1,499", period: "", features: "Everything in Starter\nPriority support", cta_label: "Get Pro", url: "", highlighted: true },
          { name: "VIP", price: "₹4,999", period: "", features: "Everything in Pro\n1:1 sessions", cta_label: "Go VIP", url: "", highlighted: false },
        ],
      },
    },
    {
      id: "testimonials",
      type: "testimonials",
      data: { _bg: "subtle", title: "Loved by customers", items: [{ quote: "Exactly what I needed.", author: "A happy buyer", role: "" }] },
    },
    {
      id: "faq",
      type: "faq",
      data: { title: "FAQ", items: [{ q: "How do I get access?", a: "Check out and get instant access." }] },
    },
    { id: "cta", type: "cta", data: { title: "Ready to buy?", subtitle: "", cta_label: "Shop now" } },
  ];
}

/** Showcase: visual-first — hero, gallery, about, products, contact. */
function showcaseBlocks(copy: Copy): SiteBlock[] {
  return [
    {
      id: "hero",
      type: "hero",
      data: { eyebrow: "Portfolio", headline: copy.headline, subheadline: copy.subheadline, cta_label: "View work", image: PIMG("showcase-hero") },
    },
    { id: "gallery", type: "gallery", data: { title: "Selected work", items: DEMO_GALLERY } },
    { id: "about", type: "about", data: { _bg: "subtle", heading: "About me", body: copy.aboutBody, image: PIMG("showcase-about", 900, 900) } },
    { id: "products", type: "products", data: { title: copy.productsTitle } },
    { id: "contact", type: "contact", data: { _bg: "subtle", title: "Get in touch" } },
    { id: "social", type: "social", data: { title: "Follow along" } },
  ];
}

/** Webinar / live event — urgency-first: hero, countdown, what you'll learn,
 *  about the host, FAQ, register CTA + contact. */
function webinarBlocks(copy: Copy): SiteBlock[] {
  return [
    {
      id: "hero",
      type: "hero",
      data: {
        eyebrow: "Free live session",
        headline: copy.headline,
        subheadline: copy.subheadline,
        cta_label: "Save my seat",
        image: PIMG("webinar-hero"),
      },
    },
    {
      id: "countdown",
      type: "countdown",
      data: { _bg: "accent", title: "Doors close in", subtitle: "Don't miss it." },
    },
    {
      id: "features",
      type: "features",
      data: {
        title: "What you'll learn",
        items: [
          { title: "The framework", text: "The exact system, step by step." },
          { title: "Live Q&A", text: "Get your questions answered in real time." },
          { title: "Bonus resources", text: "Templates & notes to keep." },
        ],
      },
    },
    { id: "about", type: "about", data: { _bg: "subtle", heading: "Your host", body: copy.aboutBody, image: PIMG("webinar-about", 900, 900) } },
    {
      id: "faq",
      type: "faq",
      data: { title: "FAQ", items: [{ q: "Is it really free?", a: "Yes — just register to save your seat." }, { q: "Will there be a replay?", a: "Register and we'll email you the details." }] },
    },
    { id: "cta", type: "cta", data: { _bg: "accent", title: "Ready to join?", subtitle: "Reserve your spot now.", cta_label: "Save my seat" } },
    { id: "contact", type: "contact", data: { title: "Questions?", subtitle: "Send us a message." } },
  ];
}

/** Personal brand — story-first: hero, about, stats, gallery, testimonials,
 *  products, social. */
function personalBlocks(copy: Copy): SiteBlock[] {
  return [
    {
      id: "hero",
      type: "hero",
      data: { eyebrow: copy.label, headline: copy.headline, subheadline: copy.subheadline, cta_label: "Work with me", image: PIMG("personal-hero", 900, 900) },
    },
    { id: "about", type: "about", data: { heading: "My story", body: copy.aboutBody, image: PIMG("personal-about", 900, 900) } },
    {
      id: "stats",
      type: "stats",
      data: { _bg: "subtle", items: [{ value: "100k+", label: "Followers" }, { value: "4.9★", label: "Rating" }, { value: "10+ yrs", label: "Experience" }] },
    },
    { id: "gallery", type: "gallery", data: { title: "Highlights", items: DEMO_GALLERY } },
    {
      id: "testimonials",
      type: "testimonials",
      data: { _bg: "subtle", title: "Kind words", items: [{ quote: "An absolute game-changer.", author: "A fan", role: "" }, { quote: "Worth every rupee.", author: "Verified buyer", role: "" }] },
    },
    { id: "products", type: "products", data: { title: copy.productsTitle } },
    { id: "social", type: "social", data: { _bg: "subtle", title: "Follow me" } },
  ];
}

/** Presets to offer a seller: their niche preset (if any) first, then generic. */
export function presetsForCategory(category?: string | null): SitePreset[] {
  const out: SitePreset[] = [];
  const copy = category ? CATEGORY_COPY[category] : undefined;
  if (copy) {
    out.push({
      key: `premium-${category}`,
      label: `✨ ${copy.label} — Premium`,
      description: "A full, polished homepage: hero, stats, pricing, FAQ, contact and more.",
      blocks: premiumBlocks(copy),
    });
    out.push({
      key: `niche-${category}`,
      label: `${copy.label} — Simple`,
      description: "The essentials — hero, about, products, socials.",
      blocks: starterBlocks(copy),
    });
  }
  out.push({
    key: "starter",
    label: "Starter homepage",
    description: "Hero, about, your products and social links.",
    blocks: starterBlocks(GENERIC),
  });
  // Structure-distinct templates — available to every niche (use niche copy
  // when known, else generic).
  const c = copy ?? GENERIC;
  out.push({
    key: "link-in-bio",
    label: "Link-in-bio",
    description: "Ultra-short — hero, your offers as cards, and social links.",
    blocks: linkInBioBlocks(c),
  });
  out.push({
    key: "storefront",
    label: "Storefront",
    description: "Commerce-first — products, pricing, reviews, FAQ and a buy CTA.",
    blocks: storefrontBlocks(c),
  });
  out.push({
    key: "showcase",
    label: "Showcase / portfolio",
    description: "Visual-first — hero, gallery, about, products and contact.",
    blocks: showcaseBlocks(c),
  });
  out.push({
    key: "webinar",
    label: "Webinar / event",
    description: "Urgency-first — hero, countdown, what you'll learn, host, FAQ and register CTA.",
    blocks: webinarBlocks(c),
  });
  out.push({
    key: "personal",
    label: "Personal brand",
    description: "Story-first — hero, your story, stats, gallery, testimonials and offers.",
    blocks: personalBlocks(c),
  });
  return out;
}
