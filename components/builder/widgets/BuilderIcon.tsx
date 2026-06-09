"use client";

// Renders a lucide icon by name. We map a curated set of the icons sellers
// actually use (social/contact/feature) rather than bundling all of lucide,
// keeping pages light. Unknown names fall back to a star.

import {
  Star,
  Check,
  Heart,
  Link as LinkIcon,
  Instagram,
  Facebook,
  Youtube,
  Twitter,
  Send, // Telegram
  MessageCircle, // WhatsApp-ish
  Phone,
  Mail,
  Globe,
  MapPin,
  ShieldCheck,
  Zap,
  Award,
  Sparkles,
  ThumbsUp,
  Clock,
  Gift,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  Star,
  Check,
  Heart,
  Link: LinkIcon,
  Instagram,
  Facebook,
  Youtube,
  Twitter,
  X: Twitter,
  Send,
  Telegram: Send,
  WhatsApp: MessageCircle,
  MessageCircle,
  Phone,
  Mail,
  Globe,
  MapPin,
  ShieldCheck,
  Zap,
  Award,
  Sparkles,
  ThumbsUp,
  Clock,
  Gift,
};

/** Names sellers can pick from (shown in the icon field). */
export const ICON_NAMES = Object.keys(MAP);

export function BuilderIcon({
  name,
  size = 24,
  color,
  className,
}: {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}) {
  const Icon = MAP[name] ?? Star;
  return <Icon size={size} color={color} className={className} />;
}
