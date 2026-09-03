import type { Metadata } from "next";
import { LegalMarkdownPage } from "@/components/legal/LegalMarkdownPage";

export const metadata: Metadata = { title: "mikkeOS Academy・Community プライバシーポリシー" };
export default function Page() { return <LegalMarkdownPage documentName="privacy-2026-09-04-v1.md" />; }
