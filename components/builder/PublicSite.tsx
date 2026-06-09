"use client";

// Public renderer for a built page. Uses the SAME BlockRenderer as the editor,
// so what the seller built is exactly what visitors see — plus the global
// header + footer, the page's animated background, the mobile sticky bottom bar,
// and the floating chat button. Interactive widgets run for real (preview=false).

import { BlockRenderer } from "@/components/builder/BlockRenderer";
import { PublicHeader } from "@/components/builder/PublicHeader";
import { AnimatedBackground, type BackgroundStyle } from "@/components/builder/AnimatedBackground";
import { MobileBottomBar, type BottomBarConfig, type PageType } from "@/components/builder/MobileBottomBar";
import { FloatingChat, type SiteContacts } from "@/components/builder/FloatingChat";
import { asDocument } from "@/lib/builder/types";

export interface PublicSiteData {
  site: {
    id: string;
    header_json?: unknown;
    footer_json?: unknown;
    contacts_json?: SiteContacts;
  };
  page: {
    content_json?: unknown;
    page_type?: PageType;
    background_style?: string;
    bottombar_json?: BottomBarConfig;
  };
}

export function PublicSite({ site, page }: PublicSiteData) {
  const header = site.header_json ? asDocument(site.header_json) : null;
  const footer = site.footer_json ? asDocument(site.footer_json) : null;
  const content = asDocument(page.content_json);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AnimatedBackground style={(page.background_style as BackgroundStyle) ?? "solid"} />

      <div className="relative z-10 flex min-h-screen flex-col">
        {header && header.sections.length > 0 && (
          <PublicHeader doc={header} siteId={site.id} />
        )}

        {/* pb to clear the fixed mobile bottom bar */}
        <main className="flex-1 pb-24 md:pb-0">
          <BlockRenderer doc={content} siteId={site.id} />
        </main>

        {footer && footer.sections.length > 0 && (
          <footer className="border-t border-black/5">
            <BlockRenderer doc={footer} siteId={site.id} />
          </footer>
        )}
      </div>

      <MobileBottomBar
        pageType={(page.page_type as PageType) ?? "landing"}
        config={page.bottombar_json}
        contacts={site.contacts_json}
      />
      <FloatingChat contacts={site.contacts_json} />
    </div>
  );
}
