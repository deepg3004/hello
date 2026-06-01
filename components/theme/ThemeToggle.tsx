"use client";

import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTheme } from "./ThemeProvider";

interface Props {
  /** Visual style: `light` for dark chrome (sidebars), `default` for light chrome. */
  variant?: "default" | "light";
  className?: string;
}

/**
 * Compact sun/moon button that flips light↔dark. The icons cross-fade with a
 * small rotate so the switch feels alive. Reused in seller + admin topbars and
 * the auth/public headers.
 */
export function ThemeToggle({ variant = "default", className }: Props) {
  const { resolvedTheme, toggle } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
        variant === "light"
          ? "text-white/70 hover:bg-white/10 hover:text-white"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <Sun
        className={cn(
          "h-[18px] w-[18px] transition-all duration-300",
          isDark
            ? "rotate-90 scale-0 opacity-0"
            : "rotate-0 scale-100 opacity-100",
        )}
      />
      <Moon
        className={cn(
          "absolute h-[18px] w-[18px] transition-all duration-300",
          isDark
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-0 opacity-0",
        )}
      />
    </button>
  );
}
