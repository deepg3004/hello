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
      data: { heading: "About me", body: copy.aboutBody },
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
      data: { _bg: "subtle", heading: "About me", body: copy.aboutBody },
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
  return out;
}
