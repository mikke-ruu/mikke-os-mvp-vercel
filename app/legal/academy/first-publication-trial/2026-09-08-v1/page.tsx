import type { Metadata } from "next";
import { LegalMarkdownPage } from "@/components/legal/LegalMarkdownPage";

export const metadata: Metadata = { title: "mikkeOS Academy 初公開7日無料 新方式特約" };
export default function Page() {
  return <LegalMarkdownPage documentName="academy-first-publication-trial-terms-2026-09-08-v1.md" />;
}
