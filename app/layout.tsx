import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Story",
  description: "Story, DESK, MarketNote, and connected apps by mikke"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
