import { ConditionalPolicyFooter } from "@/components/public/ConditionalPolicyFooter";

/**
 * Layout for seller subdomain / custom-domain pages
 * (`seller.invoxai.io` → rewritten to `/seller-host/[username]/...`).
 *
 * These routes live OUTSIDE the `(public)` route group, so they don't inherit
 * its layout — we render the compliance footer here too. Payment-gateway
 * reviewers visit the seller's branded page and require Privacy / Terms /
 * Refund links to approve the application.
 *
 * The themed storefront pages (home, /store, /course, /c, /legal) carry their
 * OWN branded footer with the same legal links, so we suppress this duplicate
 * there — it still renders on bare /<slug> checkout pages.
 */
export default function SellerHostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <ConditionalPolicyFooter hideRoot />
    </>
  );
}
