import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — InvoxAI" };

// Build-time constant — avoids making the route dynamic with `new Date()`
// (matches the convention in components/marketing/MarketingFooter.tsx).
const YEAR = 2026;

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-sora text-3xl font-semibold tracking-tight">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <strong>Last updated:</strong> {YEAR}
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground">
            1. Information We Collect
          </h2>
          <p className="mt-2">
            We collect information you provide when creating an account (name,
            email, phone), payment information processed through your connected
            payment gateway, and usage data about how you interact with our
            platform.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            2. How We Use Information
          </h2>
          <p className="mt-2">
            We use collected information to operate the InvoxAI platform,
            process transactions, send notifications, provide customer support,
            and improve our services. We do not sell personal information to
            third parties.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            3. Payment Data
          </h2>
          <p className="mt-2">
            InvoxAI does not store buyer payment card details. All payments are
            processed by the seller&apos;s connected payment gateway (Razorpay,
            Cashfree, or other). InvoxAI only receives order confirmation and
            amount data.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            4. Data Sharing
          </h2>
          <p className="mt-2">
            We share data only with: (a) your connected payment gateway for
            order processing, (b) communication providers (email, WhatsApp) for
            notifications, (c) as required by Indian law.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            5. Data Security
          </h2>
          <p className="mt-2">
            We implement industry-standard security including HTTPS encryption,
            encrypted API key storage, and role-based access controls.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">6. Contact</h2>
          <p className="mt-2">
            For privacy concerns:{" "}
            <a
              href="mailto:support@invoxai.io"
              className="text-foreground underline underline-offset-2"
            >
              support@invoxai.io
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
