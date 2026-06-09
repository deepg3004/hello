"use client";

// Mobile-only sticky bottom action bar. The PRIMARY button is set automatically
// by page type (payment → Buy, landing → CTA, leads → Submit) but can be
// overridden. SECONDARY icon buttons (Telegram/WhatsApp/Call/Instagram) appear
// only when enabled AND the matching contact is set. Hidden on desktop (md+).

import { ShoppingCart, MessageCircle, Send, Phone, Instagram } from "lucide-react";

import type { SiteContacts } from "@/components/builder/FloatingChat";
import type { Device } from "@/lib/builder/types";

export interface BottomBarConfig {
  enabled?: boolean;
  primaryLabel?: string;
  primaryHref?: string;
  channels?: { telegram?: boolean; whatsapp?: boolean; call?: boolean; instagram?: boolean };
}

export type PageType = "payment" | "landing" | "leads";

export function defaultPrimaryLabel(pageType: PageType): string {
  return pageType === "payment" ? "Buy Now" : pageType === "leads" ? "Submit" : "Get Started";
}

function tg(v: string) {
  return /^https?:\/\//i.test(v) ? v : `https://t.me/${v.replace(/^@/, "")}`;
}
function wa(v: string) {
  return /^https?:\/\//i.test(v) ? v : `https://wa.me/${v.replace(/[^\d]/g, "")}`;
}

export function MobileBottomBar({
  pageType,
  config,
  contacts,
  /** In the editor we render it inline (not fixed) so it doesn't cover the UI. */
  device,
}: {
  pageType: PageType;
  config?: BottomBarConfig;
  contacts?: SiteContacts;
  device?: Device;
}) {
  if (config?.enabled === false) return null;
  const ch = config?.channels ?? {};

  const secondary: Array<{ Icon: typeof Send; href: string; label: string }> = [];
  if (ch.whatsapp && contacts?.whatsapp) secondary.push({ Icon: MessageCircle, href: wa(contacts.whatsapp), label: "WhatsApp" });
  if (ch.telegram && contacts?.telegram) secondary.push({ Icon: Send, href: tg(contacts.telegram), label: "Telegram" });
  if (ch.call && contacts?.phone) secondary.push({ Icon: Phone, href: `tel:${contacts.phone}`, label: "Call" });
  if (ch.instagram && contacts?.instagram) secondary.push({ Icon: Instagram, href: contacts.instagram, label: "Instagram" });

  // In the editor preview we render it as an inline bar (relative); on the real
  // mobile page it's fixed to the bottom and hidden on desktop.
  const inEditor = !!device;
  const positionCls = inEditor ? "relative mt-4" : "fixed inset-x-0 bottom-0 z-50 md:hidden";

  return (
    <div
      className={`${positionCls} flex items-center gap-2 border-t border-black/10 bg-white/90 px-3 py-2.5 backdrop-blur`}
      style={{ paddingBottom: inEditor ? undefined : "calc(0.625rem + env(safe-area-inset-bottom))" }}
    >
      {secondary.map((b) => (
        <a
          key={b.label}
          href={b.href}
          target="_blank"
          rel="noreferrer"
          aria-label={b.label}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/10 text-zinc-700"
        >
          <b.Icon className="h-5 w-5" />
        </a>
      ))}
      <a
        href={config?.primaryHref || "#"}
        className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white"
      >
        {pageType === "payment" && <ShoppingCart className="h-4 w-4" />}
        {config?.primaryLabel || defaultPrimaryLabel(pageType)}
      </a>
    </div>
  );
}
