"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Menu, ShieldCheck } from "lucide-react";

import { signOutAction } from "@/actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

export interface AdminTopbarProfile {
  full_name: string | null;
  email: string;
}

interface AdminTopbarProps {
  profile: AdminTopbarProfile;
  onMenuClick: () => void;
}

// Path → friendly page title for the topbar heading
const PAGE_TITLE: Record<string, string> = {
  "": "Platform Overview",
  users: "Users",
  pages: "Pages",
  transactions: "Transactions",
  kyc: "KYC Queue",
  telegram: "Telegram",
  support: "Support",
  credentials: "Credentials",
  settings: "Platform Settings",
  "audit-logs": "Audit Logs",
};

function deriveTitle(pathname: string): string {
  const m = pathname.match(/^\/admin\/?([^/]*)/);
  const key = (m?.[1] ?? "").toLowerCase();
  if (PAGE_TITLE[key] !== undefined) return PAGE_TITLE[key];
  // Capitalise unknown segments so a new admin route still gets a readable title.
  return key ? key[0]!.toUpperCase() + key.slice(1) : "Admin";
}

export function AdminTopbar({ profile, onMenuClick }: AdminTopbarProps) {
  const pathname = usePathname();
  const title = deriveTitle(pathname);
  const initials = makeInitials(profile.full_name ?? profile.email);

  return (
    <header
      className={cn(
        "glass sticky top-0 z-20 flex h-16 items-center justify-between gap-3",
        "border-b px-4 md:px-6",
      )}
    >
      {/* Left: hamburger (mobile) + page title */}
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Mobile compact mark */}
        <Link
          href="/admin"
          className="flex items-center gap-2 font-sora text-sm font-semibold md:hidden"
        >
          <ShieldCheck className="h-4 w-4 text-amber-500" />
          Admin
        </Link>

        {/* Desktop: bold page title */}
        <h1 className="hidden truncate font-sora text-lg font-semibold tracking-tight text-foreground md:block">
          {title}
        </h1>
      </div>

      {/* Right: View User Site · Notifications · Avatar dropdown */}
      <div className="flex items-center gap-1.5">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="hidden gap-1.5 md:inline-flex"
        >
          <a
            href="https://app.invoxai.io"
            target="_blank"
            rel="noreferrer"
            title="Open app.invoxai.io in a new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View User Site
          </a>
        </Button>

        <ThemeToggle />

        <NotificationBell accent="amber" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-1 flex items-center gap-2 rounded-full outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-amber-500"
              aria-label="Admin menu"
            >
              <Avatar className="h-9 w-9 border border-border">
                <AvatarFallback className="bg-amber-400 text-xs font-semibold text-zinc-950">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-sora text-sm font-semibold">
                    {profile.full_name ?? "Admin"}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-700">
                    Admin
                  </span>
                </div>
                <span className="truncate text-xs text-muted-foreground">
                  {profile.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              {/* Absolute so it crosses from admin.invoxai.io → app.invoxai.io
                  (relative /dashboard would mis-route under the admin host). */}
              <a href={`${process.env.NEXT_PUBLIC_APP_URL || ""}/dashboard`}>
                Back to seller dashboard
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="https://app.invoxai.io" target="_blank" rel="noreferrer">
                View user site
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-rose-600 focus:text-rose-700"
              onClick={async () => {
                await signOutAction();
                window.location.href = "/login";
              }}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function makeInitials(s: string): string {
  return s
    .replace(/@.*$/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
