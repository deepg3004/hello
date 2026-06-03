import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  IndianRupee,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const TRUST = [
  { icon: ShieldCheck, label: "Razorpay-secured" },
  { icon: IndianRupee, label: "Fast INR payouts" },
  { icon: BadgeCheck, label: "GST invoices" },
];

/** Above-the-fold hero — aurora backdrop, gradient headline, product preview. */
export function LandingHero({ name }: { name: string }) {
  return (
    <section className="aurora-bg grid-overlay relative overflow-hidden">
      <div className="mx-auto w-full max-w-6xl px-5 pb-20 pt-16 sm:pt-24">
        {/* Eyebrow */}
        <div className="animate-in-up flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-card backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--brand-purple))]" />
            All-in-one creator monetization
          </span>
        </div>

        {/* Headline */}
        <h1 className="animate-in-up delay-1 mx-auto mt-6 max-w-3xl text-balance text-center font-sora text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Sell anything.{" "}
          <span className="text-gradient">Get paid fast.</span>
        </h1>

        <p className="animate-in-up delay-2 mx-auto mt-6 max-w-2xl text-balance text-center text-lg leading-8 text-muted-foreground">
          {name} gives creators and sellers payment pages, landing pages, lead
          magnets, and Telegram VIP access — with checkout, coupons, cart
          recovery, and quick payouts built in. No code required.
        </p>

        {/* CTAs */}
        <div className="animate-in-up delay-3 mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="group">
            <Link href="/signup">
              Start free
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#pricing">See pricing</a>
          </Button>
        </div>

        {/* Trust chips */}
        <div className="animate-in-up delay-4 mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          {TRUST.map((t) => (
            <span key={t.label} className="inline-flex items-center gap-1.5">
              <t.icon className="h-3.5 w-3.5 text-[hsl(var(--brand-purple))]" />
              {t.label}
            </span>
          ))}
        </div>

        {/* Product preview — a premium mock of the dashboard */}
        <div className="animate-in-up delay-5 mx-auto mt-14 max-w-4xl">
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}

/** Decorative dashboard mock — pure presentational, no data. */
function HeroPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card-lg ring-1 ring-black/5">
      {/* faux window bar */}
      <div className="flex items-center gap-1.5 border-b border-border bg-secondary/50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
      </div>
      <div className="space-y-4 p-4 sm:p-6">
        {/* charcoal hero strip */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-5">
          <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[hsl(262_83%_58%)]/30 blur-2xl" />
          <p className="relative font-sora text-sm font-semibold text-white">
            Payment Pages
          </p>
          <p className="relative mt-0.5 text-xs text-white/60">
            Sell products and services with a checkout that converts.
          </p>
        </div>
        {/* stat tiles */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { k: "Revenue", v: "₹1.8L" },
            { k: "Sales", v: "209" },
            { k: "Conversion", v: "8%" },
          ].map((s) => (
            <div key={s.k} className="rounded-xl border border-border bg-card p-3 shadow-card">
              <p className="th-label">{s.k}</p>
              <p className="mt-1 font-sora text-lg font-bold tracking-tight">{s.v}</p>
              <div className="mt-2 h-6 rounded bg-gradient-to-t from-[hsl(262_83%_58%)]/15 to-transparent" />
            </div>
          ))}
        </div>
        {/* faux rows */}
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
              <span className="h-7 w-7 rounded-lg bg-secondary" />
              <span className="h-3 flex-1 rounded bg-secondary" />
              <span className="hidden h-3 w-16 rounded bg-secondary sm:block" />
              <span className="h-5 w-14 rounded-full bg-emerald-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
