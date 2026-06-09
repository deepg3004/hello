"use client";

import { useState, type ReactNode } from "react";
import {
  BookOpen,
  CalendarClock,
  Download,
  Heart,
  LayoutDashboard,
  MapPin,
  ShoppingBag,
  UserCircle,
  Users,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  orders: ShoppingBag,
  downloads: Download,
  courses: BookOpen,
  memberships: Users,
  bookings: CalendarClock,
  wishlist: Heart,
  addresses: MapPin,
  account: UserCircle,
};

export interface AccountTab {
  key: string;
  label: string;
  count?: number;
  content: ReactNode;
}

/**
 * WooCommerce-style "My Account" — a left nav of sections (vertical on desktop,
 * horizontally scrollable on mobile) beside the active section's content. All
 * section content is server-rendered and passed in as ReactNode props.
 */
export function BuyerAccountShell({ tabs }: { tabs: AccountTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "dashboard");

  return (
    <Tabs
      value={active}
      onValueChange={setActive}
      orientation="vertical"
      className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]"
    >
      <TabsList className="flex h-auto w-full flex-row gap-1 overflow-x-auto rounded-xl border bg-card p-2 md:flex-col md:overflow-visible">
        {tabs.map((t) => {
          const Icon = ICONS[t.key] ?? LayoutDashboard;
          return (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className={cn(
                "w-full shrink-0 justify-start gap-2 rounded-lg px-3 py-2 text-sm md:shrink",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
              {t.count != null && t.count > 0 && (
                <span className="ml-auto rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                  {t.count}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      <div className="min-w-0">
        {tabs.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-0">
            {t.content}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
