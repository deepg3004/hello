"use client";

import Link from "next/link";
import {
  CreditCard,
  FileText,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  ScrollText,
  Send,
  ShieldCheck,
  Sliders,
  Users,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", Icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", Icon: Users },
  { href: "/admin/pages", label: "Pages", Icon: FileText },
  { href: "/admin/transactions", label: "Transactions", Icon: CreditCard },
  { href: "/admin/payouts", label: "Payouts", Icon: Wallet },
  { href: "/admin/telegram", label: "Telegram", Icon: Send },
  { href: "/admin/kyc", label: "KYC Queue", Icon: ShieldCheck },
  { href: "/admin/support", label: "Support", Icon: LifeBuoy },
  { href: "/admin/credentials", label: "Credentials", Icon: KeyRound },
  { href: "/admin/settings", label: "Platform Settings", Icon: Sliders },
  { href: "/admin/audit-logs", label: "Audit Logs", Icon: ScrollText },
];

export function AdminSidebar({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <div className="flex h-14 items-center border-b border-white/10 px-5">
        <Link href="/admin" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <ShieldCheck className="h-4 w-4 text-amber-400" />
          InvoxAI · Admin
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-amber-400 text-zinc-950"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
              )}
            >
              <item.Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="block rounded-md bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10"
        >
          ← Back to seller dashboard
        </Link>
        <p className="mt-2 px-3 text-[10px] uppercase tracking-wider text-zinc-500">
          admin.invoxai.io
        </p>
      </div>
    </div>
  );
}
