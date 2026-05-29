"use client";

import Link from "next/link";
import { Menu, ShieldCheck } from "lucide-react";

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

export interface AdminTopbarProfile {
  full_name: string | null;
  email: string;
}

export function AdminTopbar({
  profile,
  onMenuClick,
}: {
  profile: AdminTopbarProfile;
  onMenuClick: () => void;
}) {
  const initials = makeInitials(profile.full_name ?? profile.email);
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-zinc-950 px-4 text-zinc-100 md:px-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-zinc-300 hover:bg-white/10 hover:text-zinc-100 md:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <Link href="/admin" className="flex items-center gap-2 text-sm font-semibold md:hidden">
          <ShieldCheck className="h-4 w-4 text-amber-400" />
          Admin
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Badge className="bg-amber-400 text-zinc-950 hover:bg-amber-400">Admin</Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full focus:outline-none">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-amber-400 text-zinc-950 text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{profile.full_name ?? "Admin"}</span>
                <span className="truncate text-xs text-muted-foreground">{profile.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard">Back to seller dashboard</Link>
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
