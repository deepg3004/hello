"use client";

import Link from "next/link";
import { Bell, Menu } from "lucide-react";

import { signOutAction } from "@/actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PLANS, type PlanKey } from "@/lib/plans";

export interface TopbarProfile {
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
}

interface TopbarProps {
  profile: TopbarProfile;
  onMenuClick: () => void;
}

export function Topbar({ profile, onMenuClick }: TopbarProps) {
  const plan = ((profile.subscription_plan ?? "free") as PlanKey) in PLANS
    ? (profile.subscription_plan as PlanKey)
    : "free";
  const planName = PLANS[plan].name;
  const initials = makeInitials(profile.full_name ?? profile.email);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-card/95 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <Link href="/dashboard" className="text-base font-semibold md:hidden">
          InvoxAI
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={plan === "free" ? "outline" : "default"} className="hidden sm:inline-flex">
          {planName} plan
        </Badge>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {/* Tiny placeholder dot — wire to a notifications table later */}
          <span className="absolute right-2 top-2 hidden h-1.5 w-1.5 rounded-full bg-destructive" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full focus:outline-none">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{profile.full_name ?? "Account"}</span>
                <span className="truncate text-xs text-muted-foreground">{profile.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/upgrade">Upgrade</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
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
