// Public Telegram VIP page themes + background animations. Plain data, safe to
// import from both server (editor) and client (template).

export interface TgTheme {
  label: string;
  /** CSS background for the page. */
  bg: string;
  /** Card background (hex). All themes are dark so white/zinc text stays legible. */
  card: string;
  /** Accent hex — CTA buttons, selected-plan border, badges. */
  accent: string;
}

export const TG_THEMES: Record<string, TgTheme> = {
  purple: {
    label: "Purple",
    bg: "radial-gradient(1200px 600px at 50% -10%, #4c1d95 0%, #2e1065 45%, #1a0733 100%)",
    card: "#15151f",
    accent: "#0088cc",
  },
  midnight: {
    label: "Midnight",
    bg: "linear-gradient(160deg, #0A1628 0%, #1A2B4A 55%, #0A1628 100%)",
    card: "#0f1a2e",
    accent: "#3b82f6",
  },
  telegram: {
    label: "Telegram Blue",
    bg: "linear-gradient(160deg, #0088cc 0%, #005f8f 60%, #00344f 100%)",
    card: "#0b2942",
    accent: "#29b6f6",
  },
  emerald: {
    label: "Emerald",
    bg: "radial-gradient(1200px 600px at 50% -10%, #065f46 0%, #064e3b 50%, #022c22 100%)",
    card: "#0c1f1a",
    accent: "#10b981",
  },
  sunset: {
    label: "Sunset",
    bg: "linear-gradient(160deg, #7c2d12 0%, #9d174d 60%, #3b0764 100%)",
    card: "#1f1020",
    accent: "#fb923c",
  },
  gold: {
    label: "Black & Gold",
    bg: "linear-gradient(160deg, #0a0a0a 0%, #1a1207 60%, #000000 100%)",
    card: "#141007",
    accent: "#d4af37",
  },
};

export function tgTheme(key: string | null | undefined): TgTheme {
  return (key && TG_THEMES[key]) || TG_THEMES.purple!;
}

export const TG_ANIMATIONS: Array<{ key: string; label: string }> = [
  { key: "none", label: "None" },
  { key: "snow", label: "Snow ❄️" },
  { key: "gift", label: "Gifts 🎁" },
  { key: "party", label: "Party 🎉" },
  { key: "space", label: "Space ✨" },
  { key: "planet", label: "Planets 🪐" },
];
