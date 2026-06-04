"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface SiteLink {
  label: string;
  url: string;
  group: string;
}

// Provides the seller's linkable pages (payment/store/course/etc.) to the block
// editor so a "pagepicker" field can offer them as a dropdown.
const SiteLinksContext = createContext<SiteLink[]>([]);

export function SiteLinksProvider({
  links,
  children,
}: {
  links: SiteLink[];
  children: ReactNode;
}) {
  return <SiteLinksContext.Provider value={links}>{children}</SiteLinksContext.Provider>;
}

export function useSiteLinks(): SiteLink[] {
  return useContext(SiteLinksContext);
}
