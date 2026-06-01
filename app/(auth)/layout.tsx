import Link from "next/link";
import { BarChart3, CreditCard, Send, Sparkles, Zap } from "lucide-react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { getBranding } from "@/lib/settings";

const HIGHLIGHTS = [
  {
    Icon: CreditCard,
    title: "Payments in minutes",
    body: "Hosted checkout, coupons, upsells — no code.",
  },
  {
    Icon: Send,
    title: "Telegram VIP access",
    body: "Auto-invite buyers, auto-remove on expiry.",
  },
  {
    Icon: BarChart3,
    title: "Analytics that convert",
    body: "Recovery, affiliates, and revenue insights.",
  },
];

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getBranding();
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr] xl:grid-cols-2">
      {/* ── Left: branded showcase panel (desktop only) ──────────────── */}
      <aside className="relative hidden overflow-hidden bg-[#0E0E10] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Restrained purple glow — a single accent, not a rainbow. */}
        <div className="pointer-events-none absolute -left-32 -top-28 h-[30rem] w-[30rem] rounded-full bg-[#7C3AED]/25 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-[26rem] w-[26rem] rounded-full bg-[#06B6D4]/12 blur-[120px] animate-float" />
        {/* Subtle grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse at center, black 35%, transparent 78%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 35%, transparent 78%)",
          }}
        />

        {/* Brand mark */}
        <Link href="/" className="relative z-10 inline-flex items-center gap-2.5 w-fit">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white/15 ring-1 ring-inset ring-white/25 backdrop-blur">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.name}
                className="h-full w-full object-contain"
              />
            ) : (
              <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
            )}
          </span>
          <span className="font-sora text-lg font-semibold tracking-tight">
            {branding.name}
          </span>
        </Link>

        {/* Headline + highlights */}
        <div className="relative z-10 max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-white/85 ring-1 ring-inset ring-white/15 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            The all-in-one creator commerce platform
          </span>
          <h2 className="mt-5 font-sora text-[34px] font-bold leading-[1.15] tracking-tight">
            Get paid for what you know.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/75">
            Payment pages, landing pages, and Telegram VIP access — built for
            creators and sellers who want to move fast.
          </p>

          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-inset ring-white/20 backdrop-blur">
                  <Icon className="h-[18px] w-[18px] text-white" strokeWidth={2} />
                </span>
                <div className="leading-snug">
                  <p className="text-[14px] font-semibold">{title}</p>
                  <p className="text-[13px] text-white/65">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer note */}
        <p className="relative z-10 text-[12px] text-white/55">
          Trusted by creators across India · Secure payments by Razorpay
        </p>
      </aside>

      {/* ── Right: the form ──────────────────────────────────────────── */}
      <main className="aurora-bg relative flex items-center justify-center bg-background px-4 py-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md animate-fade-in-scale">{children}</div>
      </main>
    </div>
  );
}
