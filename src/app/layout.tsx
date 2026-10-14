import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { RememberAccount } from "@/features/account/RememberAccount";
import { MARK_SIGNED_IN_SCRIPT } from "@/features/account/signedInCookie";
import { Tracker } from "@/features/analytics/Tracker";
import { BackOrigin } from "@/features/navigation/BackOrigin";
import { display, text } from "@/lib/fonts";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "ZODE: Sovereign Superintelligence.",
  description:
    "ZODE — the connective layer for a distributed, secure compute network.",
  openGraph: {
    title: "ZODE",
    description:
      "ZODE — the connective layer for a distributed, secure compute network.",
    url: SITE_URL,
    siteName: "ZODE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  appleWebApp: {
    capable: true,
    title: "ZODE",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MARK_SIGNED_IN_SCRIPT }} />
      </head>
      <body>
        {children}
        {modal}
        <Suspense>
          <RememberAccount />
          <Tracker />
          <BackOrigin />
        </Suspense>
      </body>
    </html>
  );
}
