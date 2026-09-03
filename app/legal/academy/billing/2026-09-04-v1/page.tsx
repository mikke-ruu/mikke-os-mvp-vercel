import type { Metadata } from "next";
import { LegalMarkdownPage } from "@/components/legal/LegalMarkdownPage";

export const metadata: Metadata = { title: "mikkeOS Academy 課金・解約・返金条件" };
export default function Page() { return <LegalMarkdownPage documentName="academy-billing-2026-09-04-v1.md" />; }
