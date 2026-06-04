"use client";

import { createContext, useContext, type ReactNode } from "react";

import { publicPageUrl } from "@/lib/page-url";

// Seller's public origin (e.g. "https://dmk.invoxai.io"), provided once by the
// dashboard layout. Lets every link-building component emit subdomain-branded
// URLs without each parent page having to fetch + thread the subdomain through.
const SellerOriginContext = createContext<string | null>(null);

export function SellerProvider({
  origin,
  children,
}: {
  origin: string | null;
  children: ReactNode;
}) {
  return (
    <SellerOriginContext.Provider value={origin}>
      {children}
    </SellerOriginContext.Provider>
  );
}

/** The seller's public origin, or null when no subdomain is set. */
export function useSellerOrigin(): string | null {
  return useContext(SellerOriginContext);
}

/**
 * Returns a builder for a page's public URL. When the seller has a subdomain we
 * use the clean branded form (https://sub.invoxai.io/<slug>); otherwise we fall
 * back to the canonical main-domain URL (https://app.invoxai.io/p/<slug>).
 */
export function usePublicPageUrl() {
  const origin = useSellerOrigin();
  return (
    type: string | null | undefined,
    slug: string,
    templateId?: string | null,
  ): string =>
    origin ? `${origin}/${slug}` : publicPageUrl(type, slug, templateId);
}

/** Returns a builder for a course's public URL on the seller's host. */
export function useCourseUrl() {
  const origin = useSellerOrigin();
  const fallback = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";
  return (courseId: string): string => `${origin ?? fallback}/course/${courseId}`;
}
