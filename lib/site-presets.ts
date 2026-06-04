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
        cta_label: "Explore",
      },
    },
    {
      id: "about",
      type: "about",
      data: { heading: "About me", body: copy.aboutBody },
    },
    { id: "products", type: "products", data: { title: copy.productsTitle } },
    { id: "social", type: "social", data: { title: "Find me online" } },
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
      key: `niche-${category}`,
      label: `${copy.label} homepage`,
      description: "Pre-filled for your niche — hero, about, products, socials.",
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
