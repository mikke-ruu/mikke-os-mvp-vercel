import type { Metadata } from "next";
import { HqShell } from "@/components/hq/HqShell";

export const metadata: Metadata = {
  title: "mikkeOS 本部",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false
    }
  }
};

export default function HqLayout({ children }: { children: React.ReactNode }) {
  return <HqShell>{children}</HqShell>;
}
