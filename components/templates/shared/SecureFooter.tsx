import { Lock, ShieldCheck } from "lucide-react";

// Shared, theme-aware trust footer used across every page template so the
// "secure checkout" signal is consistent. Dark-theme friendly (all template
// themes are dark). `payment` shows payment-method badges; `lite` is a compact
// "powered by" line for landing/lead pages.

const METHODS = ["UPI", "Google Pay", "Paytm", "Visa", "Mastercard", "RuPay"];

export function SecureFooter({
  accent = "#10b981",
  variant = "payment",
}: {
  accent?: string;
  variant?: "payment" | "lite";
}) {
  if (variant === "lite") {
    return (
      <div className="mt-10 flex items-center justify-center gap-1.5 border-t border-white/10 pt-6 text-center text-xs text-zinc-400">
        <ShieldCheck className="h-3.5 w-3.5" style={{ color: accent }} />
        Your details are safe · Powered by{" "}
        <span className="font-semibold text-zinc-200">InvoxAI</span>
      </div>
    );
  }

  return (
    <footer className="mt-10 border-t border-white/10 pt-6 text-center">
      <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-200">
        <Lock className="h-3.5 w-3.5" style={{ color: accent }} />
        Guaranteed safe &amp; secure checkout
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        {METHODS.map((m) => (
          <span
            key={m}
            className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300"
          >
            {m}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-zinc-500">
        Powered by{" "}
        <span className="font-semibold text-zinc-300">InvoxAI</span> · Razorpay
        secured
      </p>
    </footer>
  );
}
