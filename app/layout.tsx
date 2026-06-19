import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mikke OS MVP",
  description: "MarketNote, Story, and DESK MVP for Mikke OS"
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
