import type { Metadata } from "next";
import { LegalMarkdownPage } from "@/components/legal/LegalMarkdownPage";

export const metadata: Metadata = { title: "mikkeOS Community 課金・解約・返金条件" };
export default function Page() { return <LegalMarkdownPage documentName="community-billing-2026-09-04-v1.md" />; }
