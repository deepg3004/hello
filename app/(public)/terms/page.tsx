import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service — InvoxAI" };

// Build-time constant — avoids making the route dynamic with `new Date()`.
const YEAR = 2026;

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-sora text-3xl font-semibold tracking-tight">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <strong>Last updated:</strong> {YEAR}
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground">
            1. Platform Description
          </h2>
          <p className="mt-2">
            InvoxAI is a SaaS platform that provides tools for Indian digital
            creators and sellers to create sales pages, manage digital product
            delivery, automate Telegram communities, and manage their online
            business. InvoxAI is not a payment gateway and does not process
            buyer payments directly.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            2. Seller Accounts
          </h2>
          <p className="mt-2">
            Sellers must: (a) provide accurate account information, (b) connect
            their own licensed payment gateway, (c) maintain sufficient wallet
            balance for platform fees, (d) comply with all applicable Indian
            laws including GST regulations.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            3. Wallet and Fees
          </h2>
          <p className="mt-2">
            Sellers maintain a prepaid wallet on InvoxAI. A platform fee is
            deducted per completed order. Wallet balances are non-refundable and
            non-transferable. Stores are automatically paused when wallet
            balance reaches zero.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            4. Prohibited Content
          </h2>
          <p className="mt-2">
            Sellers may not use InvoxAI to sell: illegal products or services,
            adult content, weapons, counterfeit goods, or products that violate
            third-party intellectual property.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            5. Governing Law
          </h2>
          <p className="mt-2">
            These terms are governed by the laws of India. Disputes are subject
            to the exclusive jurisdiction of courts in India.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">6. Contact</h2>
          <p className="mt-2">
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
