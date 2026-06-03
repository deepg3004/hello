import {
  BarChart3,
  CreditCard,
  Globe,
  Magnet,
  Send,
  Split,
  Ticket,
  Undo2,
} from "lucide-react";

const FEATURES = [
  {
    icon: CreditCard,
    title: "Payment pages that convert",
    desc: "No-code checkout with order bumps, one-time offers, and UPI/cards via Razorpay.",
  },
  {
    icon: Globe,
    title: "Landing pages",
    desc: "Launch offers, webinars, and campaigns on fast, polished pages — no developer needed.",
  },
  {
    icon: Magnet,
    title: "Lead magnets",
    desc: "Capture emails with opt-in pages and auto-deliver your freebie on signup.",
  },
  {
    icon: Send,
    title: "Telegram VIP",
    desc: "Monetize private channels with paid access, auto-invite on payment, and auto-removal on expiry.",
  },
  {
    icon: Ticket,
    title: "Coupons & affiliates",
    desc: "Atomic, oversell-proof discount codes plus a built-in affiliate program to grow sales.",
  },
  {
    icon: Undo2,
    title: "Abandoned-cart recovery",
    desc: "Win back drop-offs automatically with timed email and WhatsApp nudges.",
  },
  {
    icon: BarChart3,
    title: "Real-time analytics",
    desc: "Sales, revenue, and conversion at a glance — per page and across your whole store.",
  },
  {
    icon: Split,
    title: "A/B testing",
    desc: "Test page variants, measure the winner, and ship what actually converts.",
  },
];

/** Feature grid — each card uses the raised 3D icon tile. */
export function LandingFeatures() {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="th-label text-[hsl(var(--brand-purple))]">Everything included</p>
        <h2 className="mt-2 font-sora text-3xl font-bold tracking-tight sm:text-4xl">
          One platform to sell, grow, and get paid
        </h2>
        <p className="mt-3 text-muted-foreground">
          Replace a stack of tools with a single, polished workspace built for
          creators and sellers.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="card-surface card-surface-hover p-5"
          >
            <span className="icon-tile-3d mb-4 flex h-11 w-11 items-center justify-center">
              <f.icon className="h-5 w-5" strokeWidth={2.1} />
            </span>
            <h3 className="font-sora text-base font-semibold tracking-tight">
              {f.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {f.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
