import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // ── Typography ────────────────────────────────────────────────────
      fontFamily: {
        // Font pairing: Space Grotesk (characterful display) for headings/
        // `font-sora`, Inter for body/UI. `dm` kept as an Inter alias. Falls
        // back to Inter so headings stay sane if the webfont is slow.
        sora: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
        dm: ["Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },

      // ── Colors ────────────────────────────────────────────────────────
      colors: {
        // shadcn tokens — unchanged keys, repointed to the new HSL vars
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // ── Brand palette (use as bg-brand-indigo, text-brand-amber, etc) ─
        "brand-indigo": {
          DEFAULT: "hsl(var(--brand-indigo))",
          light: "hsl(var(--brand-indigo-light))",
        },
        "brand-amber": "hsl(var(--brand-amber))",
        "brand-emerald": "hsl(var(--brand-emerald))",
        "brand-rose": "hsl(var(--brand-rose))",
        "brand-slate": "hsl(var(--brand-slate))",
        "brand-violet": "hsl(var(--brand-violet))",
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },

      // ── Elevation — soft, layered shadows for a premium SaaS finish.
      //    Tuned on a near-black ink (16,24,40) so they read as depth, not
      //    grey haze, on the warm-ivory surfaces. Use shadow-card on resting
      //    panels, shadow-card-md on hover, shadow-card-lg on overlays/heroes.
      boxShadow: {
        // Soft, refined elevation — present enough to read as a floating surface
        // without feeling heavy (Emil-style layered shadow).
        card: "0 1px 3px 0 rgb(0 0 0 / 0.05), 0 6px 20px -4px rgb(0 0 0 / 0.07)",
        "card-md":
          "0 1px 2px 0 rgb(0 0 0 / 0.05), 0 8px 24px -8px rgb(0 0 0 / 0.10)",
        "card-lg":
          "0 12px 40px -12px rgb(0 0 0 / 0.14), 0 4px 12px -6px rgb(0 0 0 / 0.06)",
        "ring-card": "0 0 0 1px rgb(0 0 0 / 0.05)",
        // Brand glow — soft indigo halo for premium CTAs / hovered tiles.
        glow: "0 0 0 1px hsl(var(--glow-indigo) / 0.25), 0 8px 28px -6px hsl(var(--glow-indigo) / 0.35)",
        "glow-amber": "0 0 0 1px rgb(245 158 11 / 0.25), 0 8px 28px -6px rgb(245 158 11 / 0.35)",
      },

      // ── Keyframes ─────────────────────────────────────────────────────
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Skeleton shimmer — sweeps a translucent band left → right
        shimmer: {
          "0%":   { backgroundPosition: "-700px 0" },
          "100%": { backgroundPosition: "700px 0" },
        },
        // A slower variant of Tailwind's built-in pulse for ambient indicators
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.55" },
        },
        // A slower spin for loaders that shouldn't dominate the eye
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
        // Gentle vertical float for ambient/hero ornaments
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-6px)" },
        },
        // Drifting brand gradient (used with bg-[length:200%_200%])
        "gradient-drift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%":      { backgroundPosition: "100% 50%" },
        },
        // Breathing glow for live/active indicators
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--glow-indigo) / 0.45)" },
          "50%":      { boxShadow: "0 0 0 6px hsl(var(--glow-indigo) / 0)" },
        },
        // Scale + fade entry for cards/modals
        "fade-in-scale": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
      },

      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        shimmer:          "shimmer 1.6s linear infinite",
        "pulse-slow":     "pulse-slow 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow":      "spin-slow 2s linear infinite",
        float:            "float 5s ease-in-out infinite",
        "gradient-drift": "gradient-drift 8s ease-in-out infinite",
        "glow-pulse":     "glow-pulse 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in-scale":  "fade-in-scale 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
