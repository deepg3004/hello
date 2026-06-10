"use client";

// Small nav to switch between editing the Page, the global Header, and the
// global Footer — all use the same drag-drop editor.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, PanelTop, PanelBottom, Phone, LayoutGrid, Inbox, Sparkles } from "lucide-react";

const TABS = [
  { href: "/dashboard/builder/ai", label: "AI Generate", Icon: Sparkles },
  { href: "/dashboard/builder/templates", label: "Templates", Icon: LayoutGrid },
  { href: "/dashboard/builder/editor", label: "Page", Icon: FileText },
  { href: "/dashboard/builder/header", label: "Header", Icon: PanelTop },
  { href: "/dashboard/builder/footer", label: "Footer", Icon: PanelBottom },
  { href: "/dashboard/builder/settings", label: "Contacts", Icon: Phone },
  { href: "/dashboard/builder/leads", label: "Leads", Icon: Inbox },
];

export function BuilderTabs() {
  const path = usePathname();
  return (
    <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-0.5">
      {TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
