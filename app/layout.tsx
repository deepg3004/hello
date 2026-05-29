import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: {
    default: "InvoxAI — Payment pages, landing pages, Telegram VIP access",
    template: "%s · InvoxAI",
  },
  description:
    "InvoxAI is the all-in-one platform for creators and sellers to take payments, build landing pages, and sell Telegram VIP group access.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io",
  ),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
