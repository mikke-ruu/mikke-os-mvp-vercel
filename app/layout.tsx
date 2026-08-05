import type { Metadata } from "next";
import { InAppBrowserNotice } from "@/components/InAppBrowserNotice";
import { PwaRegistration } from "@/components/PwaRegistration";
import { buildPageFontsCssUrl } from "@/lib/page/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "mikke",
  description: "Story, DESK, MarketNote, and connected apps by mikke",
  manifest: "/manifest.webmanifest",
  applicationName: "mikke",
  appleWebApp: {
    capable: true,
    title: "mikke",
    statusBarStyle: "default"
  },
  themeColor: "#f75a3b"
};

// mikkeOS共通フォント（英数=Poppins／日本語=Noto Sans JP）をアプリ全体で読み込む。
// lib/page/fonts.ts の既存カタログ・ヘルパーを流用。
const appFontsCssUrl = buildPageFontsCssUrl(["noto-sans"], ["poppins"]);

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>{appFontsCssUrl ? <link rel="stylesheet" href={appFontsCssUrl} /> : null}</head>
      <body>
        <PwaRegistration />
        {children}
        <InAppBrowserNotice />
      </body>
    </html>
  );
}
