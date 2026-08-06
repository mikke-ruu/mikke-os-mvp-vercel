import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community by mikke",
  description: "参加・交流・運営のためのCommunityアプリ"
};

export default function CommunityLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
