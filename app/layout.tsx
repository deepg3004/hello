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
      <head>
        {/*
          Google Fonts — Sora (display) + DM Sans (body).
          Preconnect first so the actual stylesheet request goes out on a
          warm TCP+TLS connection. globals.css also @imports the same URL as
          a defensive fallback when this head tag is stripped (e.g. error
          pages that don't run the root layout).
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap"
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
