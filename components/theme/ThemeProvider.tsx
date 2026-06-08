"use client";

// Lightweight theme manager — no external dependency (next-themes not installed).
// Persists the user's choice to localStorage["invox-theme"] and toggles the
// `.dark` class on <html>. A "system" choice tracks prefers-color-scheme live.
//
// First paint is handled by the inline no-flash script in app/layout.tsx, which
// sets the class before React hydrates; this provider keeps it in sync after.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
// Bumped to -v3 with the Lite (pink/blue/white) theme so existing users start
// fresh on the new light default. Their toggle still works (writes this key).
export const THEME_STORAGE_KEY = "invox-theme-v3";

interface ThemeContextValue {
  /** The user's stored preference. */
  theme: Theme;
  /** The actually-applied theme after resolving "system". */
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
  /** Convenience: flip between light and dark (resolves "system" first). */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function applyClass(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialise from what the no-flash script already decided, falling back to
  // the stored value. Defaults to "dark" (Modern Dark Glass look); users who
  // previously chose a theme keep it, and the toggle still switches to light.
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Hydrate stored preference once on mount.
  useEffect(() => {
    const stored = (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || "light";
    setThemeState(stored);
  }, []);

  // Re-resolve + apply whenever the preference changes.
  useEffect(() => {
    const resolved =
      theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
    setResolvedTheme(resolved);
    applyClass(resolved);
  }, [theme]);

  // When on "system", follow OS changes live.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = mq.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      applyClass(resolved);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* ignore (private mode / storage disabled) */
    }
  }, []);

  const toggle = useCallback(() => {
    const current =
      theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
    setTheme(current === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback so a stray consumer outside the provider doesn't crash.
    return {
      theme: "system",
      resolvedTheme: "light",
      setTheme: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

/**
 * The inline script string injected into <head> to set the theme class BEFORE
 * first paint, preventing a light→dark flash. Kept here so the logic lives
 * next to the provider it mirrors.
 */
export const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}')||'light';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
