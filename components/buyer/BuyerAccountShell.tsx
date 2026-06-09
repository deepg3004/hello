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
      <TabsList className="card-surface flex h-auto w-full flex-row gap-1 overflow-x-auto p-1.5 [-ms-overflow-style:none] [scrollbar-width:none] md:sticky md:top-4 md:flex-col md:self-start md:overflow-visible [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const Icon = ICONS[t.key] ?? LayoutDashboard;
          return (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className={cn(
                "group shrink-0 justify-start gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                "md:w-full md:shrink",
                "transition-colors hover:bg-muted/70",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{t.label}</span>
              {t.count != null && t.count > 0 && (
                <span className="ml-1 rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground group-data-[state=active]:bg-primary-foreground/20 group-data-[state=active]:text-primary-foreground md:ml-auto">
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
