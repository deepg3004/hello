"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BuyerLogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await fetch("/api/buyer/logout", { method: "POST" });
        router.refresh();
      }}
    >
      <LogOut className="mr-2 h-3.5 w-3.5" />
      Sign out
    </Button>
  );
}
