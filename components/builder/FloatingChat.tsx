"use client";

// Floating chat buttons (bottom-right) built from the site's contacts. Shown on
// the public page (Phase 6) and previewed in builder settings. Renders nothing
// when no WhatsApp/Telegram contact is set.

import { Send, MessageCircle } from "lucide-react";

import { trackClick } from "@/lib/tracking/events";

export interface SiteContacts {
  telegram?: string;
  whatsapp?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  x?: string;
  youtube?: string;
}

/** Accept a full URL, a @handle, or a bare handle/number and build a link. */
function tgLink(v: string): string {
  if (/^https?:\/\//i.test(v)) return v;
  return `https://t.me/${v.replace(/^@/, "")}`;
}
function waLink(v: string): string {
  if (/^https?:\/\//i.test(v)) return v;
  return `https://wa.me/${v.replace(/[^\d]/g, "")}`;
}

export function FloatingChat({ contacts }: { contacts?: SiteContacts }) {
  const btns: Array<{ href: string; color: string; label: string; event: string; Icon: typeof Send }> = [];
  if (contacts?.whatsapp) btns.push({ href: waLink(contacts.whatsapp), color: "#25D366", label: "WhatsApp", event: "WhatsAppClick", Icon: MessageCircle });
  if (contacts?.telegram) btns.push({ href: tgLink(contacts.telegram), color: "#229ED9", label: "Telegram", event: "TelegramClick", Icon: Send });
  if (btns.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3">
      {btns.map((b) => (
        <a
          key={b.label}
          href={b.href}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackClick(b.event)}
          aria-label={`Chat on ${b.label}`}
          className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105"
          style={{ background: b.color }}
        >
          <b.Icon className="h-6 w-6" />
        </a>
      ))}
    </div>
  );
}
