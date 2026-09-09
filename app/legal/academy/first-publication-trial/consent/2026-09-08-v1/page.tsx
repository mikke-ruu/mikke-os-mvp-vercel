import type { Metadata } from "next";
import { LegalMarkdownPage } from "@/components/legal/LegalMarkdownPage";

export const metadata: Metadata = { title: "mikkeOS Academy 初公開7日無料 新方式同意事項" };
export default function Page() {
  return <LegalMarkdownPage documentName="academy-first-publication-trial-consent-2026-09-08-v1.md" />;
}
