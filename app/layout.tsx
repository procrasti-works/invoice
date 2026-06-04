import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import "./globals.css";
import { ConvexClientProvider } from "./providers";
import { PerformanceBoot } from "./_components/PerformanceBoot";
import { PwaInstallPrompt } from "./_components/PwaInstallPrompt";
import { themeBootstrapScript } from "@/lib/theme";
import { cn } from "@/lib/utils";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function getMetadataBase() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000";

  return new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`);
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  applicationName: "Payvio",
  title: "Payvio | Send client invoices",
  description:
    "Create, send, approve, and close client invoices from one focused workspace.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Payvio",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full font-sans antialiased", geist.variable, geistMono.variable)}
    >
      <body className={cn("min-h-full bg-background text-foreground", geist.className)}>
        <Script
          id="payvio-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
        <PerformanceBoot />
        <ConvexAuthNextjsServerProvider>
          <ConvexClientProvider>
            {children}
            <PwaInstallPrompt />
          </ConvexClientProvider>
        </ConvexAuthNextjsServerProvider>
      </body>
    </html>
  );
}
