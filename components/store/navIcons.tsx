import {
  Home, Store, ShoppingBag, LayoutGrid, GraduationCap, BookOpen,
  ShoppingCart, User, Heart, Search, Phone, Info, Sparkles, Tag, Gift,
  Calendar, type LucideIcon,
} from "lucide-react";

/** Curated icon set for the storefront mobile bottom nav (keys = NAV_ICONS). */
export const NAV_ICON_MAP: Record<string, LucideIcon> = {
  home: Home, store: Store, bag: ShoppingBag, grid: LayoutGrid,
  graduation: GraduationCap, book: BookOpen, cart: ShoppingCart, user: User,
  heart: Heart, search: Search, phone: Phone, info: Info, sparkles: Sparkles,
  tag: Tag, gift: Gift, calendar: Calendar,
};
