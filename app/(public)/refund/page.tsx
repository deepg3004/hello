import type { Metadata } from "next";

export const metadata: Metadata = { title: "Refund Policy — InvoxAI" };

// Build-time constant — avoids making the route dynamic with `new Date()`.
const YEAR = 2026;

export default function RefundPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-sora text-3xl font-semibold tracking-tight">
        Refund &amp; Cancellation Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <strong>Last updated:</strong> {YEAR}
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground">
            Digital Products
          </h2>
          <p className="mt-2">
            All digital products sold on InvoxAI are delivered instantly upon
            payment confirmation. Due to the nature of digital goods, all sales
            are final once the product has been delivered to the buyer.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            Refund Requests
          </h2>
          <p className="mt-2">
            Buyers may submit a refund request within{" "}
            <strong className="text-foreground">7 days of purchase</strong> if:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>The product was not delivered after successful payment</li>
            <li>The product is substantially different from its description</li>
            <li>
              A technical error prevented access to the purchased content
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            Processing Timeline
          </h2>
          <p className="mt-2">
            Approved refunds will be processed within{" "}
            <strong className="text-foreground">5–7 business days</strong> to
            the original payment method used at checkout.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            Subscription Cancellations
          </h2>
          <p className="mt-2">
            Paid subscriptions can be cancelled at any time. Access continues
            until the end of the current billing period. No partial refunds are
            issued for unused subscription time.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            Seller Responsibility
          </h2>
          <p className="mt-2">
            Each seller on InvoxAI is solely responsible for the quality,
            accuracy, and delivery of their products. Refund disputes are
            handled by InvoxAI support in coordination with the seller.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">
            Contact for Refunds
          </h2>
          <p className="mt-2">
            Email:{" "}
            <a
              href="mailto:support@invoxai.io"
              className="text-foreground underline underline-offset-2"
            >
              support@invoxai.io
            </a>
            <br />
            Response time: Within 24 business hours.
          </p>
        </section>
      </div>
    </main>
  );
}
