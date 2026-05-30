"use client";

import Link from "next/link";
import {
  CreditCard,
  FileText,
  LayoutDashboard,
  Magnet,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  emphasis?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", Icon: LayoutDashboard },
  { href: "/dashboard/pages", label: "Pages", Icon: FileText },
  { href: "/dashboard/transactions", label: "Transactions", Icon: CreditCard },
  { href: "/dashboard/customers", label: "Customers", Icon: Users },
  { href: "/dashboard/leads", label: "Leads", Icon: Magnet },
  { href: "/dashboard/telegram", label: "Telegram", Icon: Send },
  { href: "/dashboard/kyc", label: "KYC", Icon: ShieldCheck },
  { href: "/dashboard/payouts", label: "Payouts", Icon: Wallet },
  { href: "/dashboard/settings", label: "Settings", Icon: Settings },
];

const UPGRADE: NavItem = {
  href: "/dashboard/upgrade",
  label: "Upgrade",
  Icon: Sparkles,
  emphasis: true,
};

export function Sidebar({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b px-5">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight">
          InvoxAI
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => (
          <NavRow key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="border-t p-3">
        <NavRow item={UPGRADE} pathname={pathname} onNavigate={onNavigate} />
        <p className="mt-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          app.invoxai.io
        </p>
      </div>
    </div>
  );
}

function NavRow({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-primary text-primary-foreground"
          : item.emphasis
            ? "bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <item.Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}
