import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider, NO_FLASH_SCRIPT } from "@/components/theme/ThemeProvider";

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
        {/* No-flash theme: set .dark before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        {/*
          Google Fonts — Inter (UI). Preconnect first so the stylesheet
          request goes out on a warm TCP+TLS connection. globals.css also
          @imports the same URL as a defensive fallback when this head tag is
          stripped (e.g. error pages that don't run the root layout).
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
