// Course sales page — dark navy + gold accent.

import { CheckoutForm } from "@/components/pages/CheckoutForm";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const definition: TemplateDefinition = {
  id: "course",
  name: "Course Sales Page",
  description: "Premium dark/gold sales page for online courses.",
  category: "payment",
  dbType: "payment",
  thumbnail: "/templates/course.svg",
  theme: { name: "Navy + Gold", primary: "#d4af37", background: "#0a1828" },
  sections: [
    {
      id: "hero",
      label: "Hero",
      type: "hero",
      fields: [
        {
          key: "hero_eyebrow",
          label: "Eyebrow text",
          type: "text",
          defaultValue: "Online Course",
        },
        {
          key: "hero_headline",
          label: "Headline",
          type: "text",
          defaultValue: "Master React in 30 days — even if you've never coded before",
        },
        {
          key: "hero_subheadline",
          label: "Subheadline",
          type: "textarea",
          defaultValue:
            "A step-by-step program that takes you from absolute beginner to building production apps.",
        },
        {
          key: "hero_cta",
          label: "CTA button label",
          type: "text",
          defaultValue: "Enrol Now",
        },
      ],
    },
    {
      id: "benefits",
      label: "Benefits",
      type: "benefits",
      fields: [
        {
          key: "benefits_title",
          label: "Section title",
          type: "text",
          defaultValue: "What you'll get",
        },
        {
          key: "benefits_items",
          label: "Benefit bullets",
          type: "list",
          itemLabel: "benefit",
          itemFields: [
            { key: "text", label: "Text", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            { text: "30+ hours of practical video lessons" },
            { text: "10 real-world projects you'll build with me" },
            { text: "Lifetime access plus all future updates" },
            { text: "Private community of 2,000+ learners" },
            { text: "Certificate of completion" },
          ],
        },
      ],
    },
    {
      id: "instructor",
      label: "Instructor",
      type: "instructor",
      fields: [
        {
          key: "instructor_name",
          label: "Name",
          type: "text",
          defaultValue: "Your name",
        },
        {
          key: "instructor_title",
          label: "Title",
          type: "text",
          defaultValue: "Senior Engineer · 10+ years",
        },
        {
          key: "instructor_bio",
          label: "Short bio",
          type: "textarea",
          defaultValue:
            "I've shipped React apps used by millions and now I teach the exact playbook I use day to day.",
        },
        {
          key: "instructor_avatar",
          label: "Avatar image URL",
          type: "image",
          defaultValue: "",
        },
      ],
    },
    {
      id: "testimonials",
      label: "Testimonials",
      type: "testimonials",
      fields: [
        {
          key: "testimonials_title",
          label: "Section title",
          type: "text",
          defaultValue: "What students are saying",
        },
        {
          key: "testimonials_items",
          label: "Testimonials",
          type: "list",
          itemLabel: "testimonial",
          minItems: 1,
          maxItems: 6,
          itemFields: [
            { key: "quote", label: "Quote", type: "textarea", defaultValue: "" },
            { key: "author", label: "Author", type: "text", defaultValue: "" },
            { key: "role", label: "Role", type: "text", defaultValue: "" },
          ],
          defaultValue: [
            {
              quote:
                "I landed my first dev job within 2 months of finishing this. Hands down the best course I've ever taken.",
              author: "Priya S.",
              role: "Frontend Developer",
            },
            {
              quote:
                "The projects alone are worth 10x the price. Real code, real apps, no fluff.",
              author: "Rahul K.",
              role: "Full-stack Engineer",
            },
            {
              quote:
                "Finally a course that doesn't waste your time. Tight, practical, immediately useful.",
              author: "Anita M.",
              role: "Product Designer turned Dev",
            },
          ],
        },
      ],
    },
    {
      id: "faq",
      label: "FAQ",
      type: "faq",
      fields: [
        {
          key: "faq_title",
          label: "Section title",
          type: "text",
          defaultValue: "Frequently asked questions",
        },
        {
          key: "faq_items",
          label: "FAQs",
          type: "list",
          itemLabel: "Q&A",
          minItems: 1,
          maxItems: 12,
          itemFields: [
            { key: "q", label: "Question", type: "text", defaultValue: "" },
            { key: "a", label: "Answer", type: "textarea", defaultValue: "" },
          ],
          defaultValue: [
            {
              q: "Do I need prior coding experience?",
              a: "Nope. We start from absolute zero — variables, functions, the works.",
            },
            {
              q: "How long do I have access?",
              a: "Forever. One payment, lifetime access including updates.",
            },
            {
              q: "Will this work on my laptop?",
              a: "Yes — anything from the last 5 years runs the toolchain comfortably.",
            },
            {
              q: "Is there a refund policy?",
              a: "14-day no-questions-asked refund. Just email us.",
            },
            {
              q: "Will you help me when I'm stuck?",
              a: "Yes — the private community is monitored daily by me and senior students.",
            },
          ],
        },
      ],
    },
    {
      id: "checkout",
      label: "Checkout",
      type: "checkout",
      fields: [
        {
          key: "checkout_title",
          label: "Section title",
          type: "text",
          defaultValue: "Enrol today",
        },
        {
          key: "checkout_guarantee",
          label: "Guarantee line",
          type: "text",
          defaultValue: "14-day money-back guarantee. No questions asked.",
        },
      ],
    },
  ],
};

interface BenefitItem { text: string }
interface TestimonialItem { quote: string; author: string; role: string }
interface FaqItem { q: string; a: string }

const Render: TemplateRender = ({ values, pageId, product, isPreview }) => {
  const headline = readField(values, "hero_headline", "");
  const sub = readField(values, "hero_subheadline", "");
  const eyebrow = readField(values, "hero_eyebrow", "");
  const cta = readField(values, "hero_cta", "Enrol Now");

  const benefits = readField<BenefitItem[]>(values, "benefits_items", []);
  const benefitsTitle = readField(values, "benefits_title", "What you'll get");

  const instructorName = readField(values, "instructor_name", "");
  const instructorTitle = readField(values, "instructor_title", "");
  const instructorBio = readField(values, "instructor_bio", "");
  const instructorAvatar = readField(values, "instructor_avatar", "");

  const testimonialsTitle = readField(values, "testimonials_title", "");
  const testimonials = readField<TestimonialItem[]>(values, "testimonials_items", []);

  const faqTitle = readField(values, "faq_title", "");
  const faqs = readField<FaqItem[]>(values, "faq_items", []);

  const checkoutTitle = readField(values, "checkout_title", "Enrol today");
  const guarantee = readField(values, "checkout_guarantee", "");

  return (
    <div className="min-h-screen bg-[#0a1828] text-zinc-100">
      {/* HERO */}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-12 text-center">
        {eyebrow && (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#d4af37]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          {headline}
        </h1>
        {sub && (
          <p className="mt-5 text-lg leading-relaxed text-zinc-300">{sub}</p>
        )}
        <a
          href="#enrol"
          className="mt-8 inline-block rounded-md bg-[#d4af37] px-6 py-3 text-sm font-semibold text-[#0a1828] shadow hover:brightness-110"
        >
          {cta}
        </a>
      </section>

      {/* BENEFITS */}
      {benefits.length > 0 && (
        <section className="border-t border-white/5 bg-[#0d1f33] py-16">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight">{benefitsTitle}</h2>
            <ul className="mt-6 space-y-3">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[#d4af37]" />
                  <span className="text-zinc-200">{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* INSTRUCTOR */}
      {(instructorName || instructorBio) && (
        <section className="border-t border-white/5 py-16">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 text-center md:flex-row md:text-left">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-[#d4af37]/60 bg-zinc-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {instructorAvatar ? (
                <img src={instructorAvatar} alt={instructorName} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div>
              <p className="text-sm uppercase tracking-widest text-[#d4af37]">Your instructor</p>
              <h3 className="mt-1 text-xl font-semibold">{instructorName}</h3>
              <p className="text-sm text-zinc-400">{instructorTitle}</p>
              <p className="mt-3 text-zinc-300">{instructorBio}</p>
            </div>
          </div>
        </section>
      )}

      {/* TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section className="border-t border-white/5 bg-[#0d1f33] py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight">{testimonialsTitle}</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {testimonials.map((t, i) => (
                <figure key={i} className="rounded-lg border border-white/5 bg-[#0a1828] p-5">
                  <blockquote className="text-sm leading-relaxed text-zinc-200">“{t.quote}”</blockquote>
                  <figcaption className="mt-4 text-sm">
                    <div className="font-medium text-[#d4af37]">{t.author}</div>
                    <div className="text-xs text-zinc-400">{t.role}</div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="border-t border-white/5 py-16">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight">{faqTitle}</h2>
            <dl className="mt-6 space-y-5">
              {faqs.map((f, i) => (
                <div key={i}>
                  <dt className="font-medium text-zinc-100">{f.q}</dt>
                  <dd className="mt-1 text-zinc-400">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* CHECKOUT */}
      <section id="enrol" className="border-t border-white/5 bg-[#0d1f33] py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight">{checkoutTitle}</h2>
          {guarantee && (
            <p className="mt-2 text-center text-sm text-zinc-400">{guarantee}</p>
          )}
          <div className="mt-8 rounded-xl bg-white p-6 text-zinc-900">
            {pageId && product && !isPreview ? (
              <CheckoutForm
                pageId={pageId}
                productId={product.id}
                productName={product.name}
                productDescription={product.description}
                productImage={product.image_url}
                price={Number(product.price)}
                currency={product.currency}
              />
            ) : (
              <p className="text-center text-sm text-zinc-500">
                {isPreview
                  ? "Checkout form renders on the live page."
                  : "Attach a product to this page to enable checkout."}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export const courseTemplate: Template = {
  definition,
  Render,
  defaultValues: extractDefaults(definition),
};
