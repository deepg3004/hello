import Link from "next/link";

/**
 * Compliance footer shown on every public seller page (apex `/p/...`,
 * A/B variants, lead/telegram pages, and seller subdomains via
 * `app/seller-host/layout.tsx`).
 *
 * Payment-gateway reviewers (Razorpay, Cashfree) manually open a seller's
 * page and reject the application if Privacy / Terms / Refund links are
 * missing — so this must render everywhere a buyer can land.
 *
 * Links are root-relative; `middleware.ts` lets `/privacy|/terms|/refund`
 * fall through to the `(public)` route group on every host (including seller
 * subdomains and custom domains), so they resolve without leaving the
 * seller's branded domain.
 */
export function PolicyFooter() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-5 py-8 text-xs text-muted-foreground">
        <Link href="/privacy" className="transition hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href="/terms" className="transition hover:text-foreground">
          Terms of Service
        </Link>
        <Link href="/refund" className="transition hover:text-foreground">
          Refund Policy
        </Link>
        <a
          href="mailto:support@invoxai.io"
          className="transition hover:text-foreground"
        >
          Contact Us
        </a>
        <span>
          Powered by{" "}
          <Link href="/" className="font-semibold transition hover:text-foreground">
            InvoxAI
          </Link>
        </span>
      </div>
    </footer>
  );
}
