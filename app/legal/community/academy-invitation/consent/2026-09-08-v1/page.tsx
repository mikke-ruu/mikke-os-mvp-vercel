import type { Metadata } from "next";
import { LegalMarkdownPage } from "@/components/legal/LegalMarkdownPage";

export const metadata: Metadata = {
  title: "Academy連携Community招待 本人同意事項"
};

export default function Page() {
  return (
    <LegalMarkdownPage documentName="academy-first-publication-community-invitation-consent-2026-09-08-v1.md" />
  );
}
